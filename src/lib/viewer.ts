import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { DEMO_USER_COOKIE, VOTER_COOKIE, VOTER_COOKIE_OPTIONS } from "@/lib/cookies";
import { isDemo } from "@/lib/env";
import { createUserClient } from "@/lib/supabase/server";
import type { Me } from "@/lib/types";

export type Viewer = {
  /** 투표 중복 판정 키. 로그인: 'u:<uid>', 비회원: 'a:<브라우저 ID>' */
  voterKey: string;
  user: Me | null;
  ipHash: string | null;
};

export const DEMO_USER: Me = { id: "00000000-0000-4000-8000-00000000d3a0", name: "체험 사용자", avatar: null };

export async function getUser(): Promise<Me | null> {
  if (isDemo) {
    const cookieStore = await cookies();
    return cookieStore.get(DEMO_USER_COOKIE) ? DEMO_USER : null;
  }
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = meta[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  };
  return {
    id: claims.sub,
    name: pick("name", "full_name", "user_name", "preferred_username") ?? "카카오 사용자",
    avatar: pick("avatar_url", "picture"),
  };
}

/** Route Handler에서 요청자를 식별합니다. */
export async function getViewer(): Promise<Viewer> {
  const cookieStore = await cookies();
  let voterId = cookieStore.get(VOTER_COOKIE)?.value;
  if (!voterId) {
    // 보통은 proxy가 먼저 발급합니다. 혹시 빠졌다면 여기서 발급합니다.
    voterId = randomUUID();
    cookieStore.set(VOTER_COOKIE, voterId, VOTER_COOKIE_OPTIONS);
  }

  const user = await getUser();

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip");
  const salt = process.env.VOTE_SALT || process.env.SUPABASE_SECRET_KEY || "this-or-that";
  const ipHash = ip ? createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32) : null;

  return { voterKey: user ? `u:${user.id}` : `a:${voterId}`, user, ipHash };
}
