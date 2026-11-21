import { displayName } from "@/lib/comments";
import { fetchLinkMeta } from "@/lib/link-preview";
import { store } from "@/lib/store";
import { parseNewPost } from "@/lib/validate";
import { getViewer } from "@/lib/viewer";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.user) return Response.json({ error: "카카오 로그인 후 글을 쓸 수 있습니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = parseNewPost(body, viewer.user.id);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  // 링크의 제목과 대표 사진은 브라우저가 보낸 값을 믿지 않고 서버가 직접 받아 저장합니다.
  const { post } = parsed;
  const [aLinkMeta, bLinkMeta] = await Promise.all([post.aLink, post.bLink].map((link) => (link ? fetchLinkMeta(link) : null)));

  const id = await store.createPost(
    { id: viewer.user.id, name: displayName(viewer.user.name) },
    { ...post, aLinkMeta, bLinkMeta },
  );
  return Response.json({ id }, { status: 201 });
}
