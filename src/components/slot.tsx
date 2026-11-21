"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { PostView } from "@/lib/types";
import { Board, MysteryBoard } from "./board";
import { ReelFooter, ReelLanding, ReelLoop, ReelQuestion, ReelWindow } from "./reel";
import { ShareButton } from "./share-button";

type Phase = "spinning" | "landing" | "landed" | "empty" | "error";
type Feed = { post: PostView | null; reel: string[] };

const MIN_SPIN_MS = 700;
const FILLER_COUNT = 7;

/** 서버에서 받은 질문이 모자랄 때 릴을 채우는 문구. */
const STOCK_REEL = ["짜장면이냐 짬뽕이냐", "지금 살까 말까", "부먹이냐 찍먹이냐", "갈까 말까", "이거냐 저거냐"];

function fill(questions: string[]): string[] {
  const source = questions.length >= 3 ? questions : [...questions, ...STOCK_REEL];
  return Array.from({ length: FILLER_COUNT }, (_, index) => source[index % source.length]);
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function Slot() {
  const [phase, setPhase] = useState<Phase>("spinning");
  const [post, setPost] = useState<PostView | null>(null);
  const [loopItems, setLoopItems] = useState<string[]>(STOCK_REEL);
  const [strip, setStrip] = useState<string[]>([]);
  const seen = useRef<string[]>([]);
  const run = useRef(0);

  /** 다음 포스팅을 받아옵니다. 릴이 너무 금방 멈추지 않게 최소 시간은 돌립니다. */
  const fetchNext = useCallback(async (): Promise<Feed> => {
    const started = performance.now();
    const query = (ids: string[]) => api<Feed>(`/api/feed?exclude=${ids.join(",")}`);
    let feed = await query(seen.current.slice(-150));
    if (!feed.post && seen.current.length > 0) {
      // 건너뛴 글까지 다 돌았으면 처음부터 다시 돕니다 (이미 투표한 글은 서버가 뺍니다).
      seen.current = [];
      feed = await query([]);
    }
    await sleep(Math.max(0, MIN_SPIN_MS - (performance.now() - started)));
    return feed;
  }, []);

  const land = useCallback((feed: Feed) => {
    if (!feed.post) {
      setPhase("empty");
      return;
    }
    seen.current.push(feed.post.id);
    const fillers = fill(feed.reel);
    setPost(feed.post);
    setStrip([...fillers, feed.post.question]);
    setLoopItems(fillers);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase(still ? "landed" : "landing");
  }, []);

  const load = useCallback(() => {
    const id = ++run.current;
    fetchNext()
      .then((feed) => id === run.current && land(feed))
      .catch(() => id === run.current && setPhase("error"));
  }, [fetchNext, land]);

  // 들어오자마자 한 번 돌립니다.
  useEffect(() => {
    load();
  }, [load]);

  const spin = () => {
    setPhase("spinning");
    setPost(null);
    load();
  };

  const onLanded = useCallback(() => setPhase((current) => (current === "landing" ? "landed" : current)), []);

  if (phase === "empty" || phase === "error") {
    return (
      <div className="flex flex-1 flex-col pt-2.5">
        <ReelWindow plain>
          <ReelQuestion plain text={phase === "empty" ? "돌릴 고민이 다 떨어졌어요" : "고민을 불러오지 못했어요"} />
        </ReelWindow>
        <p className="text-p">
          {phase === "empty"
            ? "올라온 고민에 모두 답했습니다. 이번엔 내 고민을 올려 보세요."
            : "인터넷 연결을 확인한 뒤 다시 돌려 주세요."}
        </p>
        <div className="mt-[30px] flex flex-col gap-[15px]">
          {phase === "empty" && (
            <Link href="/new" className="btn btn-primary">
              고민 올리기
            </Link>
          )}
          <button
            type="button"
            onClick={spin}
            className={phase === "error" ? "btn btn-primary" : "btn btn-secondary"}
          >
            다시 돌리기
          </button>
        </div>
      </div>
    );
  }

  const landed = phase === "landed" && post !== null;
  const voted = landed && post.myChoice !== null;

  return (
    <div className="flex flex-1 flex-col pt-2.5">
      <ReelWindow>
        {phase === "spinning" && <ReelLoop items={loopItems} />}
        {phase === "landing" && <ReelLanding key={post?.id} items={strip} onLanded={onLanded} />}
        {landed && (
          <>
            <ReelQuestion text={post.question} />
            <ReelFooter author={post.author} expiresAt={post.expiresAt} closed={post.closed} />
          </>
        )}
      </ReelWindow>

      <p className="sr-only" aria-live="polite">
        {landed ? `고민: ${post.question}` : "고민을 고르는 중"}
      </p>

      {landed ? <Board key={post.id} post={post} onChange={setPost} /> : <MysteryBoard />}

      <div className="mt-auto flex gap-[15px] pt-10">
        <button
          type="button"
          onClick={spin}
          disabled={!landed}
          className={`btn flex-1 px-5 ${voted || !landed ? "btn-primary" : "btn-secondary"}`}
        >
          {!landed ? "돌아가는 중" : voted ? "다음 고민 돌리기" : "다른 고민 돌리기"}
        </button>
        {landed && <ShareButton postId={post.id} question={post.question} />}
      </div>
    </div>
  );
}
