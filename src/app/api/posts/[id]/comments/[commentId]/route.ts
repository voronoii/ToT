import { loadComments } from "@/lib/comments";
import { isPostId, store } from "@/lib/store";
import { getViewer } from "@/lib/viewer";

type Context = { params: Promise<{ id: string; commentId: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const { id, commentId } = await params;
  const viewer = await getViewer();
  if (!viewer.user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const post = isPostId(id) && isPostId(commentId) ? await store.getPost(id) : null;
  if (!post) return Response.json({ error: "없는 글이거나 삭제된 글입니다." }, { status: 404 });

  // 고민 글쓴이는 자기 글의 댓글을 모두, 그 밖의 사람은 자기 댓글만 지울 수 있습니다.
  const isPostAuthor = post.author_id === viewer.user.id;
  const deleted = await store.deleteComment(id, commentId, isPostAuthor ? null : viewer.voterKey);
  if (!deleted) return Response.json({ error: "지울 수 없는 댓글입니다." }, { status: 404 });
  return Response.json(await loadComments(post, viewer));
}
