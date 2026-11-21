import type { NextRequest } from "next/server";
import { isPostId, store, toView } from "@/lib/store";
import { getViewer } from "@/lib/viewer";

/** 슬롯머신 한 번 돌릴 분량: 멈출 포스팅 하나와, 릴에 스쳐 지나갈 다른 질문들. */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  const exclude = (request.nextUrl.searchParams.get("exclude") ?? "")
    .split(",")
    .filter(isPostId)
    .slice(0, 200);

  const rows = await store.feed(viewer.voterKey, exclude, 8);
  const [target, ...rest] = rows;
  return Response.json({
    post: target ? toView(target, viewer, null) : null,
    reel: rest.map((row) => row.question),
  });
}
