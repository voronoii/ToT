import "server-only";

import { IMAGE_BUCKET, isDemo, SUPABASE_URL } from "@/lib/env";
import type { Choice, PostRow, PostView, VoteStatus } from "@/lib/types";
import type { Viewer } from "@/lib/viewer";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";

export type NewPost = {
  question: string;
  aText: string | null;
  aImage: string | null;
  bText: string | null;
  bImage: string | null;
  expiresAt: string | null;
};

export type VoteResult = { status: VoteStatus; myChoice: Choice | null; countA: number; countB: number };

export interface Store {
  /** 아직 투표하지 않았고 마감되지 않은 포스팅을 무작위로. */
  feed(voterKey: string, exclude: string[], limit: number): Promise<PostRow[]>;
  getPost(id: string): Promise<PostRow | null>;
  getChoices(voterKey: string, postIds: string[]): Promise<Record<string, Choice>>;
  vote(postId: string, choice: Choice, voterKey: string, ipHash: string | null): Promise<VoteResult>;
  createPost(authorId: string, post: NewPost): Promise<string>;
  listByAuthor(authorId: string): Promise<PostRow[]>;
  deletePost(authorId: string, id: string): Promise<boolean>;
}

export const store: Store = isDemo ? memoryStore : supabaseStore;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isPostId = (value: string) => UUID.test(value);

export function imageUrl(stored: string | null): string | null {
  if (!stored) return null;
  if (stored.startsWith("data:")) return stored; // 데모 모드
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${stored}`;
}

export function toView(row: PostRow, viewer: Viewer, myChoice: Choice | null): PostView {
  const closed = row.expires_at !== null && new Date(row.expires_at).getTime() <= Date.now();
  const mine = viewer.user?.id === row.author_id;
  const reveal = myChoice !== null || closed || mine;
  return {
    id: row.id,
    question: row.question,
    a: { text: row.a_text, image: imageUrl(row.a_image) },
    b: { text: row.b_text, image: imageUrl(row.b_image) },
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    closed,
    mine,
    myChoice,
    counts: reveal ? { a: row.count_a, b: row.count_b } : null,
  };
}
