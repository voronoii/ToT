import { isPostId, store, toView } from "@/lib/store";
import type { Choice } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

const MESSAGES: Record<string, [message: string, status: number]> = {
  closed: ["마감된 투표입니다.", 409],
  not_found: ["없는 글이거나 삭제된 글입니다.", 404],
  ip_limit: ["이 네트워크에서 너무 많은 투표가 들어왔습니다. 잠시 후 다시 시도하세요.", 429],
  invalid: ["둘 중 하나를 골라 주세요.", 400],
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { choice?: unknown } | null;
  const choice = body?.choice;
  if (!isPostId(id)) return Response.json({ error: MESSAGES.not_found[0] }, { status: 404 });
  if (choice !== "a" && choice !== "b") return Response.json({ error: MESSAGES.invalid[0] }, { status: 400 });

  const viewer = await getViewer();
  const result = await store.vote(id, choice as Choice, viewer.voterKey, viewer.ipHash);

  // 이미 투표했거나 마감된 경우에도 현재 결과는 돌려줘 화면이 결과 상태로 넘어가게 합니다.
  if (result.status === "ok" || result.status === "already" || result.status === "closed") {
    const row = await store.getPost(id);
    if (!row) return Response.json({ error: MESSAGES.not_found[0] }, { status: 404 });
    return Response.json({ status: result.status, post: toView(row, viewer, result.myChoice) });
  }

  const [message, status] = MESSAGES[result.status] ?? ["투표하지 못했습니다.", 500];
  return Response.json({ error: message }, { status });
}
