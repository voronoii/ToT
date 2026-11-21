import { fetchLinkMeta, normalizeLink } from "@/lib/link-preview";
import { toLinkView } from "@/lib/store";
import { getViewer } from "@/lib/viewer";

/** 글쓰기 화면에서, 붙여 넣은 링크가 어떻게 보일지 미리 확인합니다. 글을 쓸 수 있는 사람만 부를 수 있습니다. */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const link = normalizeLink(body?.url);
  if (!link) {
    return Response.json({ error: "http나 https로 시작하는 주소만 넣을 수 있습니다." }, { status: 400 });
  }
  return Response.json({ link: toLinkView(link, await fetchLinkMeta(link)) });
}
