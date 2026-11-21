import { store, toView } from "@/lib/store";
import { getViewer } from "@/lib/viewer";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer.user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const rows = await store.listByAuthor(viewer.user.id);
  return Response.json({ posts: rows.map((row) => toView(row, viewer, null)) });
}
