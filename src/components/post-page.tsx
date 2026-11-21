"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client";
import type { PostView } from "@/lib/types";
import { Board, MysteryBoard } from "./board";
import { ReelFooter, ReelQuestion, ReelWindow } from "./reel";
import { ShareButton } from "./share-button";

export function PostPage({ id }: { id: string }) {
  const router = useRouter();
  const [post, setPost] = useState<PostView | null>(null);
  const [problem, setProblem] = useState<"missing" | "offline" | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ post: PostView }>(`/api/posts/${id}`)
      .then((data) => alive && setPost(data.post))
      .catch((cause) => alive && setProblem(cause instanceof ApiError && cause.status === 404 ? "missing" : "offline"));
    return () => {
      alive = false;
    };
  }, [id]);

  async function remove() {
    if (!post || !window.confirm("이 고민을 삭제할까요? 받은 투표도 함께 사라집니다.")) return;
    setDeleting(true);
    try {
      await api(`/api/posts/${post.id}`, { method: "DELETE" });
      router.push("/me");
    } catch (cause) {
      setDeleting(false);
      window.alert(cause instanceof Error ? cause.message : "삭제하지 못했습니다.");
    }
  }

  if (problem) {
    return (
      <div className="flex flex-1 flex-col pt-2.5">
        <ReelWindow plain>
          <ReelQuestion plain text={problem === "missing" ? "없는 글이거나 삭제된 글이에요" : "글을 불러오지 못했어요"} />
        </ReelWindow>
        <Link href="/" className="btn btn-primary mt-2.5">
          다른 고민 돌리기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pt-2.5">
      <ReelWindow>
        {post && (
          <>
            <ReelQuestion text={post.question} />
            <ReelFooter author={post.author} expiresAt={post.expiresAt} closed={post.closed} />
          </>
        )}
      </ReelWindow>
      {post ? <Board post={post} onChange={setPost} /> : <MysteryBoard />}

      {post?.mine && post.counts && post.counts.a + post.counts.b === 0 && (
        <p className="mt-5 rounded-md bg-grey px-5 py-[15px] text-p">
          내가 올린 고민입니다. 링크를 공유하면 친구들도 바로 투표할 수 있어요.
        </p>
      )}

      <div className="mt-auto flex flex-col gap-[15px] pt-10">
        <div className="flex gap-[15px]">
          <Link href="/" className="btn btn-primary flex-1 px-5">
            다른 고민 돌리기
          </Link>
          {post && <ShareButton postId={post.id} question={post.question} />}
        </div>
        {post?.mine && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="self-center rounded-sm px-2 py-1 text-p underline underline-offset-4"
          >
            {deleting ? "삭제하는 중" : "이 고민 삭제"}
          </button>
        )}
      </div>
    </div>
  );
}
