import { cleanNickname } from "@/lib/nickname";
import { store } from "@/lib/store";
import { NICKNAME_MAX } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

/** 닉네임을 정하거나 바꿉니다. 이미 올린 글과 댓글의 이름은 바뀌지 않습니다. */
export async function PUT(request: Request) {
  const viewer = await getViewer();
  if (!viewer.user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { nickname?: unknown } | null;
  const nickname = cleanNickname(body?.nickname);
  if (!nickname) {
    return Response.json({ error: `닉네임은 1자에서 ${NICKNAME_MAX}자까지 쓸 수 있습니다.` }, { status: 400 });
  }

  await store.setNickname(viewer.user.id, nickname);
  return Response.json({ nickname });
}
