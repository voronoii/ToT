import "server-only";

import { store } from "@/lib/store";
import { AUTHOR_NAME_MAX, type CommentState, type CommentsView, type PostRow } from "@/lib/types";
import type { Viewer } from "@/lib/viewer";

const LIST_LIMIT = 50;

/** DB 제약(40자)에 맞춰 표시 이름을 자릅니다. */
export const displayName = (name: string) => [...name].slice(0, AUTHOR_NAME_MAX).join("");

/** 댓글도 투표 결과와 같은 조건에서만 보여줍니다: 투표했거나, 마감됐거나, 내 글일 때. */
export async function canSeeComments(post: PostRow, viewer: Viewer): Promise<boolean> {
  if (viewer.user?.id === post.author_id) return true;
  if (post.expires_at !== null && new Date(post.expires_at).getTime() <= Date.now()) return true;
  const choices = await store.getChoices(viewer.voterKey, [post.id]);
  return post.id in choices;
}

export async function loadComments(post: PostRow, viewer: Viewer): Promise<CommentsView> {
  const [{ rows, total }, status] = await Promise.all([
    store.listComments(post.id, LIST_LIMIT),
    viewer.user ? store.getCommentStatus(post.id, viewer.voterKey) : null,
  ]);

  let state: CommentState;
  if (!viewer.user) state = "login";
  else if (!status) state = "not_voted";
  else if (status.active) state = "written";
  else if (status.used) state = "deleted";
  else state = "open";

  return {
    comments: rows.map((row) => ({
      id: row.comment_id,
      text: row.comment,
      author: row.comment_author,
      choice: row.choice,
      createdAt: row.commented_at,
      mine: row.voter_key === viewer.voterKey,
    })),
    total,
    state,
    canModerate: viewer.user?.id === post.author_id,
  };
}
