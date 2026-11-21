import { displayName } from "@/lib/comments";
import { store } from "@/lib/store";
import { parseNewPost } from "@/lib/validate";
import { getViewer } from "@/lib/viewer";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.user) return Response.json({ error: "카카오 로그인 후 글을 쓸 수 있습니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = parseNewPost(body, viewer.user.id);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  const id = await store.createPost({ id: viewer.user.id, name: displayName(viewer.user.name) }, parsed.post);
  return Response.json({ id }, { status: 201 });
}
