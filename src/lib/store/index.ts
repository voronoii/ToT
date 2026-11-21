import "server-only";

import { IMAGE_BUCKET, isDemo, SUPABASE_URL } from "@/lib/env";
import { linkHost, looksLikeLink, normalizeLink, readLinkMeta } from "@/lib/link-preview";
import {
  POST_DAILY_LIMIT,
  POST_LIMIT_WINDOW_MS,
  type Choice,
  type CommentRow,
  type LinkMeta,
  type LinkView,
  type OptionView,
  type PostQuota,
  type PostRow,
  type PostView,
  type VoteStatus,
} from "@/lib/types";
import type { Viewer } from "@/lib/viewer";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";

export type NewPost = {
  question: string;
  aText: string | null;
  aImage: string | null;
  aLink: string | null;
  aLinkMeta: LinkMeta | null;
  bText: string | null;
  bImage: string | null;
  bLink: string | null;
  bLinkMeta: LinkMeta | null;
  expiresAt: string;
};

/** 최근 24시간 동안 올릴 수 있는 횟수를 다 썼을 때. */
export class PostLimitError extends Error {
  constructor() {
    super("post_limit");
  }
}

export type VoteResult = { status: VoteStatus; myChoice: Choice | null; countA: number; countB: number };

export interface Store {
  /** 아직 투표하지 않았고 마감되지 않은 포스팅을 무작위로. */
  feed(voterKey: string, exclude: string[], limit: number): Promise<PostRow[]>;
  getPost(id: string): Promise<PostRow | null>;
  getChoices(voterKey: string, postIds: string[]): Promise<Record<string, Choice>>;
  vote(postId: string, choice: Choice, voterKey: string, ipHash: string | null): Promise<VoteResult>;
  /** 횟수를 다 썼으면 PostLimitError를 던집니다. */
  createPost(author: { id: string; name: string }, post: NewPost): Promise<string>;
  /** 최근 24시간 동안 글을 올린 시각들, 오래된 것부터. 지운 글도 포함합니다. */
  recentPostTimes(authorId: string): Promise<string[]>;
  listByAuthor(authorId: string): Promise<PostRow[]>;
  deletePost(authorId: string, id: string): Promise<boolean>;

  /** 최근 댓글부터. before를 주면 그 시각보다 먼저 쓴 댓글만. total은 지워지지 않은 댓글 전체 수. */
  listComments(postId: string, limit: number, before?: string | null): Promise<{ rows: CommentRow[]; total: number }>;
  /** 내 투표 행의 댓글 상태. 투표한 적이 없으면 null. used는 지운 댓글까지 포함해 "한 번"을 이미 썼는지. */
  getCommentStatus(postId: string, voterKey: string): Promise<{ used: boolean; active: boolean } | null>;
  addComment(postId: string, voterKey: string, authorName: string, text: string): Promise<"ok" | "not_voted" | "already">;
  /** onlyVoterKey를 주면 그 사람이 쓴 댓글일 때만 지웁니다. null이면 누구 댓글이든 지웁니다 (고민 글쓴이용). */
  deleteComment(postId: string, commentId: string, onlyVoterKey: string | null): Promise<boolean>;
}

export const store: Store = isDemo ? memoryStore : supabaseStore;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isPostId = (value: string) => UUID.test(value);

export function imageUrl(stored: string | null): string | null {
  if (!stored) return null;
  if (stored.startsWith("data:")) return stored; // 데모 모드
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${stored}`;
}

export async function getPostQuota(authorId: string): Promise<PostQuota> {
  const times = await store.recentPostTimes(authorId);
  const remaining = Math.max(0, POST_DAILY_LIMIT - times.length);
  // 다 썼으면, 한도 안에서 가장 오래된 기록이 24시간을 넘기는 때에 한 자리가 납니다.
  const oldest = times[times.length - POST_DAILY_LIMIT];
  const nextAt = remaining === 0 && oldest ? new Date(new Date(oldest).getTime() + POST_LIMIT_WINDOW_MS).toISOString() : null;
  return { limit: POST_DAILY_LIMIT, remaining, nextAt };
}

export function toLinkView(link: string | null, meta: unknown): LinkView | null {
  if (!link || !/^https?:\/\//i.test(link)) return null;
  return { url: link, host: linkHost(link), ...(readLinkMeta(meta) ?? { title: null, image: null }) };
}

function toOption(text: string | null, image: string | null, link: string | null, meta: unknown): OptionView {
  // 링크 칸이 생기기 전에 글 칸에 주소만 적어 올린 글도, 누르려다 투표되지 않게 링크로 보여줍니다 (미리보기는 없음).
  if (!link && text && looksLikeLink(text)) {
    const moved = normalizeLink(text);
    if (moved) return { text: null, image: imageUrl(image), link: toLinkView(moved, null) };
  }
  return { text, image: imageUrl(image), link: toLinkView(link, meta) };
}

/** 목록이나 공유 미리보기에서 보기를 한 줄로 부를 이름. */
export function optionName(row: PostRow, side: Choice): string {
  const option = side === "a" ? toOption(row.a_text, null, row.a_link, row.a_link_meta) : toOption(row.b_text, null, row.b_link, row.b_link_meta);
  return option.text ?? option.link?.title ?? option.link?.host ?? "사진";
}

export function toView(row: PostRow, viewer: Viewer, myChoice: Choice | null): PostView {
  const closed = row.expires_at !== null && new Date(row.expires_at).getTime() <= Date.now();
  const mine = viewer.user?.id === row.author_id;
  const reveal = myChoice !== null || closed || mine;
  return {
    id: row.id,
    question: row.question,
    author: row.author_name,
    a: toOption(row.a_text, row.a_image, row.a_link, row.a_link_meta),
    b: toOption(row.b_text, row.b_image, row.b_link, row.b_link_meta),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    closed,
    mine,
    myChoice,
    counts: reveal ? { a: row.count_a, b: row.count_b } : null,
  };
}
