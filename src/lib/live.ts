"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { isDemo } from "@/lib/env";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { PostView } from "@/lib/types";

type Counts = { a: number; b: number };

/**
 * 포스팅의 득표수를 실시간으로 받습니다.
 * Supabase Realtime으로 posts 행의 변경을 구독하고, 데모 모드에서는 짧은 주기로 다시 읽습니다.
 * 휴대폰에서 탭이 뒤로 갔다 돌아오면 놓친 변경을 한 번 다시 읽어 맞춥니다.
 */
export function useLiveCounts(postId: string, enabled: boolean, onCounts: (counts: Counts) => void) {
  const handler = useRef(onCounts);
  useEffect(() => {
    handler.current = onCounts;
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    const refetch = () =>
      api<{ post: PostView }>(`/api/posts/${postId}`)
        .then(({ post }) => alive && post.counts && handler.current(post.counts))
        .catch(() => {});

    const onVisible = () => document.visibilityState === "visible" && refetch();
    document.addEventListener("visibilitychange", onVisible);

    let stop: () => void;
    if (isDemo) {
      const timer = window.setInterval(() => document.visibilityState === "visible" && refetch(), 2500);
      stop = () => window.clearInterval(timer);
    } else {
      const supabase = getBrowserClient();
      const channel = supabase
        .channel(`post:${postId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "posts", filter: `id=eq.${postId}` },
          (payload) => {
            const row = payload.new as { count_a?: number; count_b?: number };
            if (typeof row.count_a === "number" && typeof row.count_b === "number") {
              handler.current({ a: row.count_a, b: row.count_b });
            }
          },
        )
        .subscribe();
      stop = () => void supabase.removeChannel(channel);
    }

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      stop();
    };
  }, [postId, enabled]);
}

/** 남은 시간 표시를 위해 주기적으로 갱신되는 현재 시각. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
