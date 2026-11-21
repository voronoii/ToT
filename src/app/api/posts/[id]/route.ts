import { isPostId, store, toView } from "@/lib/store";
import { getViewer } from "@/lib/viewer";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const viewer = await getViewer();
  const row = isPostId(id) ? await store.getPost(id) : null;
  if (!row) return Response.json({ error: "없는 글이거나 삭제된 글입니다." }, { status: 404 });
  const choices = await store.getChoices(viewer.voterKey, [id]);
  return Response.json({ post: toView(row, viewer, choices[id] ?? null) });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const deleted = isPostId(id) ? await store.deletePost(viewer.user.id, id) : false;
  if (!deleted) return Response.json({ error: "내 글만 삭제할 수 있습니다." }, { status: 404 });
  return Response.json({ ok: true });
}
