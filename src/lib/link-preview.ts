import "server-only";

import { lookup } from "node:dns/promises";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { LinkMeta } from "@/lib/types";

/*
 * 보기에 붙인 링크의 제목과 대표 사진을 받아옵니다 (카카오톡 링크 미리보기와 같은 정보).
 *
 * 사용자가 준 주소로 서버가 접속하는 일이라 다음을 지킵니다.
 * - http/https, 기본 포트, 이름으로 된 주소만 받습니다 (IP 직접 입력, 계정 정보가 든 주소는 거절).
 * - 이름을 풀어 나온 주소가 내부망·자기 자신이면 접속하지 않고, 확인한 바로 그 주소로만 연결합니다.
 * - 다른 곳으로 넘기는 응답도 같은 검사를 다시 거치며, 세 번까지만 따라갑니다.
 * - 전체 5초, 본문은 앞부분 40만 바이트까지만 읽습니다.
 */

const TIMEOUT_MS = 5000;
const MAX_BYTES = 400_000;
const MAX_REDIRECTS = 3;
export const LINK_MAX = 500;
const TITLE_MAX = 80;
const IMAGE_URL_MAX = 1000;

/** 빈 값이면 null, 받을 수 없는 주소면 undefined, 괜찮으면 정리한 주소. */
export function normalizeLink(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  if (url.username || url.password || url.port) return undefined;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0 || !host.includes(".") || host.endsWith(".")) return undefined;
  return url.href.length <= LINK_MAX ? url.href : undefined;
}

/** 글 칸에 주소만 덩그러니 적었는지. 그런 글은 링크로 옮겨 줍니다. */
export const looksLikeLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

/** 화면에 보여줄 사이트 이름. 저장해 둔 값이 아니라 링크 자체에서 뽑으므로 속일 수 없습니다. */
export function linkHost(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

function isPublicAddress(address: string, family: number): boolean {
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  // IPv6는 일반 공인 대역(2000::/3)만 허용합니다. 문서용 대역과 IPv4를 감싼 주소는 뺍니다.
  const lower = address.toLowerCase();
  if (!/^[23]/.test(lower)) return false;
  if (lower.startsWith("2001:db8") || lower.startsWith("2002:")) return false;
  return true;
}

type Target = { address: string; family: number };

async function resolvePublic(hostname: string): Promise<Target> {
  const records = await lookup(hostname, { all: true });
  if (records.length === 0 || records.some((record) => !isPublicAddress(record.address, record.family))) {
    throw new Error("공개된 주소가 아닙니다");
  }
  return records[0];
}

type Fetched = { status: number; location: string | null; contentType: string; body: Buffer };

function fetchOnce(url: URL, target: Target, timeoutMs: number): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: "GET",
        timeout: timeoutMs,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-language": "ko,en;q=0.8",
          "accept-encoding": "gzip, deflate, br",
          "user-agent": "Mozilla/5.0 (compatible; thisorthat-link-preview/1.0)",
        },
        // 이름을 다시 풀지 않고, 방금 공개 주소로 확인한 그 주소에만 연결합니다.
        lookup: (_hostname, options, callback) => {
          if (typeof options === "object" && options.all) {
            callback(null, [{ address: target.address, family: target.family }]);
          } else {
            callback(null, target.address, target.family);
          }
        },
      },
      (response: IncomingMessage) => {
        const status = response.statusCode ?? 0;
        const header = (name: string) => {
          const value = response.headers[name];
          return Array.isArray(value) ? value[0] : (value ?? "");
        };
        const done = (body: Buffer) => {
          request.destroy();
          resolve({ status, location: header("location") || null, contentType: header("content-type"), body });
        };
        if (status >= 300 && status < 400) return done(Buffer.alloc(0));

        const encoding = header("content-encoding").toLowerCase();
        const decoder =
          encoding === "gzip" ? createGunzip() : encoding === "br" ? createBrotliDecompress() : encoding === "deflate" ? createInflate() : null;
        const stream = decoder ? response.pipe(decoder) : response;
        const chunks: Buffer[] = [];
        let size = 0;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          done(Buffer.concat(chunks));
        };
        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
          // 제목과 대표 사진은 문서 앞부분에 있으므로, 그만큼만 읽고 끊습니다.
          if (size >= MAX_BYTES) finish();
        });
        stream.on("end", finish);
        // 도중에 끊으면 압축 풀기가 오류를 낼 수 있습니다. 그때까지 읽은 것으로 충분합니다.
        stream.on("error", finish);
        response.on("error", finish);
      },
    );
    request.on("timeout", () => request.destroy(new Error("응답이 너무 늦습니다")));
    request.on("error", reject);
    request.end();
  });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
    const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : whole;
  });
}

function decodeBody(body: Buffer, contentType: string): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 4096).toString("latin1"))?.[1];
  for (const label of [fromHeader, fromMeta, "utf-8"]) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(body);
    } catch {
      // 모르는 문자 집합이면 다음 후보로 넘어갑니다.
    }
  }
  return body.toString("utf8");
}

function parseMeta(html: string, pageUrl: URL): LinkMeta {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd >= 0 ? html.slice(0, headEnd) : html;

  const found = new Map<string, string>();
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
    }
    const key = (attributes.get("property") ?? attributes.get("name") ?? "").toLowerCase();
    const content = attributes.get("content");
    if (key && content && !found.has(key)) found.set(key, content);
  }

  const rawTitle = found.get("og:title") ?? found.get("twitter:title") ?? /<title[^>]*>([^<]*)/i.exec(head)?.[1] ?? "";
  const cleaned = decodeEntities(rawTitle).replace(/\s+/g, " ").trim();
  const title = cleaned ? [...cleaned].slice(0, TITLE_MAX).join("") : null;

  let image: string | null = null;
  const rawImage = found.get("og:image:secure_url") ?? found.get("og:image") ?? found.get("twitter:image");
  if (rawImage) {
    try {
      const resolved = new URL(decodeEntities(rawImage).trim(), pageUrl);
      // http 사진은 https 화면에서 막히므로 https만 씁니다.
      if (resolved.protocol === "https:" && resolved.href.length <= IMAGE_URL_MAX) image = resolved.href;
    } catch {
      // 주소가 이상하면 사진 없이 둡니다.
    }
  }
  return { title, image };
}

/** 링크의 미리보기를 받아옵니다. 받지 못하면 null (그래도 링크 자체는 쓸 수 있습니다). */
export async function fetchLinkMeta(link: string): Promise<LinkMeta | null> {
  const deadline = Date.now() + TIMEOUT_MS;
  try {
    let current = link;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = new URL(current);
      const target = await resolvePublic(url.hostname);
      const remaining = deadline - Date.now();
      if (remaining <= 0) return null;
      const response = await fetchOnce(url, target, remaining);

      if (response.status >= 300 && response.status < 400) {
        if (!response.location) return null;
        const next = normalizeLink(new URL(response.location, url).href);
        if (!next) return null;
        current = next;
        continue;
      }
      if (response.status !== 200 || !/html/i.test(response.contentType)) return null;
      const meta = parseMeta(decodeBody(response.body, response.contentType), url);
      return meta.title || meta.image ? meta : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** DB에서 읽은 미리보기 값을 믿을 수 있는 모양으로 걸러 냅니다. */
export function readLinkMeta(value: unknown): LinkMeta | null {
  if (typeof value !== "object" || value === null) return null;
  const { title, image } = value as Record<string, unknown>;
  return {
    title: typeof title === "string" && title.trim() ? [...title.trim()].slice(0, TITLE_MAX).join("") : null,
    image: typeof image === "string" && image.startsWith("https://") && image.length <= IMAGE_URL_MAX ? image : null,
  };
}
