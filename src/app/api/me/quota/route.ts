import { getPostQuota } from "@/lib/store";
import { getViewer } from "@/lib/viewer";

/** 지금 고민을 몇 개 더 올릴 수 있는지. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer.user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return Response.json(await getPostQuota(viewer.user.id));
}
