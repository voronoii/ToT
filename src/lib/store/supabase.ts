import "server-only";

import { randomUUID } from "node:crypto";
import { IMAGE_BUCKET } from "@/lib/env";
import { createAdminClient, createUserClient } from "@/lib/supabase/server";
import type { Choice, CommentRow, PostRow, VoteStatus } from "@/lib/types";
import type { Store } from "./index";

const COLUMNS = "id, author_id, author_name, question, a_text, a_image, b_text, b_image, count_a, count_b, expires_at, created_at";

export const supabaseStore: Store = {
  async feed(voterKey, exclude, limit) {
    const { data, error } = await createAdminClient().rpc("random_posts", {
      p_voter_key: voterKey,
      p_exclude: exclude,
      p_limit: limit,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as PostRow[];
  },

  async getPost(id) {
    const { data, error } = await createAdminClient().from("posts").select(COLUMNS).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as PostRow | null;
  },

  async getChoices(voterKey, postIds) {
    if (postIds.length === 0) return {};
    const { data, error } = await createAdminClient()
      .from("votes")
      .select("post_id, choice")
      .eq("voter_key", voterKey)
      .in("post_id", postIds);
    if (error) throw new Error(error.message);
    const choices: Record<string, Choice> = {};
    for (const row of data ?? []) choices[row.post_id as string] = row.choice as Choice;
    return choices;
  },

  async vote(postId, choice, voterKey, ipHash) {
    const { data, error } = await createAdminClient().rpc("cast_vote", {
      p_post_id: postId,
      p_choice: choice,
      p_voter_key: voterKey,
      p_ip_hash: ipHash,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as
      | { status: VoteStatus; my_choice: Choice | null; total_a: number; total_b: number }
      | undefined;
    if (!row) throw new Error("투표 결과를 받지 못했습니다.");
    return { status: row.status, myChoice: row.my_choice, countA: row.total_a, countB: row.total_b };
  },

  // 글쓰기와 삭제는 사용자 세션으로 실행해 RLS가 "본인 글만"을 강제하게 합니다.
  async createPost(author, post) {
    const supabase = await createUserClient();
    const { data, error } = await supabase
      .from("posts")
      .insert({
        author_id: author.id,
        author_name: author.name,
        question: post.question,
        a_text: post.aText,
        a_image: post.aImage,
        b_text: post.bText,
        b_image: post.bImage,
        expires_at: post.expiresAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  },

  async listByAuthor(authorId) {
    const { data, error } = await createAdminClient()
      .from("posts")
      .select(COLUMNS)
      .eq("author_id", authorId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as PostRow[];
  },

  async deletePost(authorId, id) {
    const supabase = await createUserClient();
    const { data, error } = await supabase
      .from("posts")
      .delete()
      .eq("id", id)
      .eq("author_id", authorId)
      .select("a_image, b_image");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return false;
    const images = data.flatMap((row) => [row.a_image, row.b_image]).filter((path): path is string => !!path);
    if (images.length > 0) {
      // 사진 정리가 실패해도 글 삭제는 이미 끝났으므로 결과에 영향을 주지 않습니다.
      await supabase.storage.from(IMAGE_BUCKET).remove(images);
    }
    return true;
  },

  // 댓글은 votes 행에 붙어 있고, votes는 서버 키로만 접근합니다.
  async listComments(postId, limit, before) {
    const admin = createAdminClient();
    let page = admin
      .from("votes")
      .select("comment_id, comment, comment_author, choice, commented_at, voter_key")
      .eq("post_id", postId)
      .not("comment", "is", null);
    if (before) page = page.lt("commented_at", before);
    // 전체 수는 쪽과 상관없이 세어야 해서 따로 묻습니다.
    const [rows, all] = await Promise.all([
      page.order("commented_at", { ascending: false }).order("comment_id", { ascending: false }).limit(limit),
      admin.from("votes").select("comment_id", { count: "exact", head: true }).eq("post_id", postId).not("comment", "is", null),
    ]);
    if (rows.error) throw new Error(rows.error.message);
    if (all.error) throw new Error(all.error.message);
    return { rows: (rows.data ?? []) as CommentRow[], total: all.count ?? 0 };
  },

  async getCommentStatus(postId, voterKey) {
    const { data, error } = await createAdminClient()
      .from("votes")
      .select("comment, commented_at")
      .eq("post_id", postId)
      .eq("voter_key", voterKey)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { used: data.commented_at !== null, active: data.comment !== null } : null;
  },

  async addComment(postId, voterKey, authorName, text) {
    // "아직 댓글을 쓴 적 없는 내 투표 행"만 고치는 한 문장이라, 동시에 두 번 눌러도 한 번만 들어갑니다.
    const { data, error } = await createAdminClient()
      .from("votes")
      .update({
        comment: text,
        comment_author: authorName,
        comment_id: randomUUID(),
        commented_at: new Date().toISOString(),
      })
      .eq("post_id", postId)
      .eq("voter_key", voterKey)
      .is("commented_at", null)
      .select("comment_id");
    if (error) throw new Error(error.message);
    if (data && data.length > 0) return "ok";
    return (await this.getCommentStatus(postId, voterKey)) ? "already" : "not_voted";
  },

  async deleteComment(postId, commentId, onlyVoterKey) {
    // 내용만 지우고 commented_at은 남겨, 지운 뒤에 다시 쓸 수 없게 합니다.
    let query = createAdminClient()
      .from("votes")
      .update({ comment: null, comment_author: null })
      .eq("post_id", postId)
      .eq("comment_id", commentId)
      .not("comment", "is", null);
    if (onlyVoterKey) query = query.eq("voter_key", onlyVoterKey);
    const { data, error } = await query.select("comment_id");
    if (error) throw new Error(error.message);
    return !!data && data.length > 0;
  },
};
