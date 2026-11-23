import type { NextRequest } from "next/server";

/** 로그인 후 돌아갈 경로. 사이트 안의 경로만 허용합니다. */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

/** 닉네임 정하는 화면. 정하고 나면 next로 돌아갑니다. */
export const nicknamePath = (next: string) => `/nickname?next=${encodeURIComponent(next)}`;

export function siteOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}
