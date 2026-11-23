import { isDemo } from "@/lib/env";
import { nicknameOrNull } from "@/lib/profile";
import { getUser } from "@/lib/viewer";

/** 로그인한 사람. name은 직접 정한 닉네임이 있으면 그것, 없으면 카카오 닉네임입니다. */
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ user: null, nickname: null, demo: isDemo });
  const nickname = await nicknameOrNull(user.id);
  return Response.json({ user: { ...user, name: nickname ?? user.name }, nickname, demo: isDemo });
}
