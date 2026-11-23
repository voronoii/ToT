import "server-only";

import { displayName } from "@/lib/comments";
import { store } from "@/lib/store";
import type { Me } from "@/lib/types";

/** 글과 댓글에 남길 이름: 직접 정한 닉네임, 없으면 카카오 닉네임. */
export async function authorName(user: Me): Promise<string> {
  return (await store.getNickname(user.id)) ?? displayName(user.name);
}

/**
 * 닉네임을 읽지 못해도 로그인 자체는 되어야 하므로, 실패하면 "아직 안 정함"으로 봅니다.
 * (예: 0007_profiles.sql을 아직 실행하지 않은 경우)
 */
export async function nicknameOrNull(userId: string): Promise<string | null> {
  try {
    return await store.getNickname(userId);
  } catch (cause) {
    console.error("닉네임을 읽지 못했습니다:", cause);
    return null;
  }
}
