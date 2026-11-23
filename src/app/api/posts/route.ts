import { fetchLinkMeta } from "@/lib/link-preview";
import { authorName } from "@/lib/profile";
import { getPostQuota, PostLimitError, store } from "@/lib/store";
import { POST_DAILY_LIMIT } from "@/lib/types";
import { parseNewPost } from "@/lib/validate";
import { getViewer } from "@/lib/viewer";

const limited = () =>
  Response.json(
    { error: `고민은 24시간 동안 ${POST_DAILY_LIMIT}개까지 올릴 수 있습니다. 조금 뒤에 다시 올려 주세요.` },
    { status: 429 },
  );

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.user) return Response.json({ error: "카카오 로그인 후 글을 쓸 수 있습니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = parseNewPost(body, viewer.user.id);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  // 횟수를 다 쓴 사람은 링크 미리보기를 받으러 가기 전에 돌려보냅니다. (최종 판정은 저장할 때 DB가 합니다.)
  if ((await getPostQuota(viewer.user.id)).remaining === 0) return limited();

  // 링크의 제목과 대표 사진은 브라우저가 보낸 값을 믿지 않고 서버가 직접 받아 저장합니다.
  const { post } = parsed;
  const [aLinkMeta, bLinkMeta] = await Promise.all([post.aLink, post.bLink].map((link) => (link ? fetchLinkMeta(link) : null)));

  try {
    const id = await store.createPost(
      { id: viewer.user.id, name: await authorName(viewer.user) },
      { ...post, aLinkMeta, bLinkMeta },
    );
    return Response.json({ id }, { status: 201 });
  } catch (cause) {
    if (cause instanceof PostLimitError) return limited();
    throw cause;
  }
}
