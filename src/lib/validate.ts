import "server-only";

import { isDemo } from "@/lib/env";
import { looksLikeLink, normalizeLink } from "@/lib/link-preview";
import type { NewPost } from "@/lib/store";
import { DEFAULT_EXPIRY, EXPIRY_OPTIONS, OPTION_TEXT_MAX, QUESTION_MAX } from "@/lib/types";

const length = (value: string) => [...value].length;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed === "" ? null : trimmed;
}

function image(value: unknown, userId: string): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  if (isDemo) {
    return /^data:image\/(jpeg|webp|png);base64,/.test(value) && value.length <= 600_000 ? value : undefined;
  }
  // 본인 폴더에 올린 사진 경로만 허용합니다 (DB 정책에서도 한 번 더 확인).
  const [folder, file, ...rest] = value.split("/");
  const ok = rest.length === 0 && folder === userId && /^[A-Za-z0-9-]{8,64}\.(jpg|webp|png)$/.test(file ?? "");
  return ok ? value : undefined;
}

/** 링크 미리보기는 검증이 끝난 뒤 따로 받아 붙입니다. */
export type ParsedPost = Omit<NewPost, "aLinkMeta" | "bLinkMeta">;

const SIDE_NAMES = ["첫 번째", "두 번째"] as const;

export function parseNewPost(body: unknown, userId: string): { post: ParsedPost } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "요청 형식이 올바르지 않습니다." };
  const input = body as Record<string, unknown>;

  const question = text(input.question);
  if (!question) return { error: "질문을 입력하세요." };
  if (length(question) > QUESTION_MAX) return { error: `질문은 ${QUESTION_MAX}자까지 쓸 수 있습니다.` };

  const texts = [text(input.aText), text(input.bText)];
  const links: (string | null)[] = [];
  for (const [index, raw] of [input.aLink, input.bLink].entries()) {
    let link = normalizeLink(raw);
    if (link === undefined) {
      return { error: `${SIDE_NAMES[index]} 보기의 링크를 확인하세요. http나 https로 시작하는 주소만 넣을 수 있습니다.` };
    }
    // 글 칸에 주소만 적었으면 링크로 옮깁니다. 주소가 글로 남으면 누르려다 투표가 되어 버립니다.
    const written = texts[index];
    if (!link && written && looksLikeLink(written)) {
      link = normalizeLink(written) ?? null;
      if (link) texts[index] = null;
    }
    links.push(link);
  }
  const [aText, bText] = texts;
  const [aLink, bLink] = links;
  if ((aText && length(aText) > OPTION_TEXT_MAX) || (bText && length(bText) > OPTION_TEXT_MAX)) {
    return { error: `보기는 ${OPTION_TEXT_MAX}자까지 쓸 수 있습니다.` };
  }

  const aImage = image(input.aImage, userId);
  const bImage = image(input.bImage, userId);
  if (aImage === undefined || bImage === undefined) return { error: "사진을 다시 올려 주세요." };

  if (!aText && !aImage && !aLink) return { error: "첫 번째 보기에 글, 사진, 링크 중 하나를 넣으세요." };
  if (!bText && !bImage && !bLink) return { error: "두 번째 보기에 글, 사진, 링크 중 하나를 넣으세요." };

  // 기한은 6시간 또는 하루뿐이고, 값이 없거나 이상하면 하루로 둡니다.
  const chosen = input.expiresIn ?? DEFAULT_EXPIRY;
  const expiry = EXPIRY_OPTIONS.find((option) => option.value === chosen);
  if (!expiry) return { error: "투표 기한은 6시간 또는 하루 중에서 고르세요." };
  const expiresAt = new Date(Date.now() + expiry.ms).toISOString();

  return { post: { question, aText, aImage, aLink, bText, bImage, bLink, expiresAt } };
}
