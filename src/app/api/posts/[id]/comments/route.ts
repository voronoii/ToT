import { canSeeComments, loadComments } from "@/lib/comments";
import { authorName } from "@/lib/profile";
import { isPostId, store } from "@/lib/store";
import { COMMENT_MAX } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

type Context = { params: Promise<{ id: string }> };

const MISSING = "없는 글이거나 삭제된 글입니다.";

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const viewer = await getViewer();
  const post = isPostId(id) ? await store.getPost(id) : null;
  if (!post) return Response.json({ error: MISSING }, { status: 404 });
  if (!(await canSeeComments(post, viewer))) {
    return Response.json({ error: "투표하면 댓글을 볼 수 있습니다." }, { status: 403 });
  }
  // before: "더 보기"에서 넘기는 기준 시각. 형식이 이상하면 첫 쪽을 줍니다.
  const raw = new URL(request.url).searchParams.get("before");
  const before = raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : null;
  return Response.json(await loadComments(post, viewer, before));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.user) return Response.json({ error: "카카오 로그인 후 댓글을 남길 수 있습니다." }, { status: 401 });

  const post = isPostId(id) ? await store.getPost(id) : null;
  if (!post) return Response.json({ error: MISSING }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (!text) return Response.json({ error: "댓글을 입력하세요." }, { status: 400 });
  if ([...text].length > COMMENT_MAX) {
    return Response.json({ error: `댓글은 ${COMMENT_MAX}자까지 쓸 수 있습니다.` }, { status: 400 });
  }

  const result = await store.addComment(id, viewer.voterKey, await authorName(viewer.user), text);
  if (result === "not_voted") {
    return Response.json({ error: "투표한 뒤에 댓글을 남길 수 있습니다." }, { status: 409 });
  }
  if (result === "already") {
    return Response.json({ error: "댓글은 한 번만 남길 수 있습니다. 지운 뒤에도 다시 쓸 수 없습니다." }, { status: 409 });
  }
  return Response.json(await loadComments(post, viewer), { status: 201 });
}
