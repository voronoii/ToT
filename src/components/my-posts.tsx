"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, percents, remainingLabel } from "@/lib/client";
import { useNow } from "@/lib/live";
import type { PostView } from "@/lib/types";
import { LoginPrompt } from "./login-prompt";
import { useMe } from "./me";

export function MyPosts() {
  const { ready, user } = useMe();
  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    api<{ posts: PostView[] }>("/api/me/posts")
      .then((data) => alive && setPosts(data.posts))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [user]);

  async function remove(post: PostView) {
    if (!window.confirm("이 고민을 삭제할까요? 받은 투표도 함께 사라집니다.")) return;
    try {
      await api(`/api/posts/${post.id}`, { method: "DELETE" });
      setPosts((current) => current?.filter((item) => item.id !== post.id) ?? null);
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "삭제하지 못했습니다.");
    }
  }

  if (!ready) return null;
  if (!user) {
    return (
      <LoginPrompt next="/me" title="내 글은 로그인하면 보여요" body="카카오로 로그인하면 내가 올린 고민과 투표 결과를 모아 볼 수 있습니다." />
    );
  }

  return (
    <div className="flex flex-1 flex-col pt-2.5">
      <h1 className="text-h2">
        <span className="hl hl-green">내가 올린 고민</span>
      </h1>
      <div className="mt-5 flex items-center justify-between text-p">
        <span>{user.name} 님</span>
        <form action="/auth/logout" method="post">
          <button type="submit" className="rounded-sm underline underline-offset-4">
            로그아웃
          </button>
        </form>
      </div>

      {failed && (
        <p role="alert" className="mt-[30px] rounded-md border border-dark bg-grey px-5 py-[15px] text-p">
          글을 불러오지 못했습니다. 새로고침해 주세요.
        </p>
      )}

      {posts?.length === 0 && (
        <div className="mt-[30px] rounded-lg bg-grey px-[30px] py-10">
          <p className="text-h3">아직 올린 고민이 없어요</p>
          <p className="mt-5 text-p">둘 중에 못 고르겠는 게 있다면 올려 보세요. 사람들이 대신 골라줍니다.</p>
          <Link href="/new" className="btn btn-primary mt-[30px] w-full">
            고민 올리기
          </Link>
        </div>
      )}

      {posts && <PostList posts={posts} onRemove={remove} />}
    </div>
  );
}

const ROWS = [
  { side: "a", word: "this", label: "hl-green" },
  { side: "b", word: "that", label: "hl-black" },
] as const;

/** 글을 받아온 뒤에만 그려지므로 현재 시각을 여기서 읽습니다. */
function PostList({ posts, onRemove }: { posts: PostView[]; onRemove: (post: PostView) => void }) {
  const now = useNow();
  return (
    <ul className="mt-[30px] flex flex-col gap-[30px]">
      {posts.map((post) => {
        const result = percents(post.counts ?? { a: 0, b: 0 });
        const deadline = remainingLabel(post.expiresAt, now);
        return (
          <li key={post.id} className="card bg-grey px-[30px] py-[30px]">
            <Link href={`/p/${post.id}`} className="block rounded-sm">
              <h2 className="text-title">{post.question}</h2>
              <div className="mt-5 flex flex-col gap-2">
                {ROWS.map((row) => (
                  <div key={row.side} className="flex items-center gap-2.5 text-p">
                    <span className={`hl ${row.label}`}>{row.word}</span>
                    <span className="min-w-0 flex-1 truncate">{post[row.side].text ?? "사진"}</span>
                    {result.total > 0 && <span className="font-medium tabular-nums">{result[row.side]}%</span>}
                  </div>
                ))}
              </div>
              <div className="mt-[15px] flex h-5 overflow-hidden rounded-md border border-dark bg-white">
                {result.total > 0 && (
                  <>
                    <div className="bg-green" style={{ width: `${result.a}%` }} />
                    <div className="bg-dark" style={{ width: `${result.b}%` }} />
                  </>
                )}
              </div>
            </Link>
            <div className="mt-[15px] flex items-center justify-between gap-3 text-p">
              <span>
                {result.total === 0 ? "아직 투표가 없어요" : `${result.total.toLocaleString("ko-KR")}명 참여`}
                {deadline && <span className="ml-3">{deadline}</span>}
              </span>
              <button type="button" onClick={() => onRemove(post)} className="shrink-0 rounded-sm underline underline-offset-4">
                삭제
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
