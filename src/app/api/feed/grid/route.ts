import { store } from "@/lib/store";
import { getViewer } from "@/lib/viewer";

/** 한 화면에 깔 수 있는 최대 장수. DB의 random_posts도 20개까지만 돌려줍니다. */
const GRID_MAX = 20;

/** 모아 보기 한 판: 아직 투표하지 않았고 마감되지 않은 고민을 무작위로. */
export async function GET() {
  const viewer = await getViewer();
  const rows = await store.feed(viewer.voterKey, [], GRID_MAX);
  return Response.json({ posts: rows.map((row) => ({ id: row.id, question: row.question })) });
}
