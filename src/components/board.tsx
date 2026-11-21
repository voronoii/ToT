"use client";

import { useCallback, useState } from "react";
import { api, percents, remainingLabel } from "@/lib/client";
import { useLiveCounts, useNow } from "@/lib/live";
import type { Choice, OptionView, PostView } from "@/lib/types";

/** this는 green, that은 dark. 고른 카드는 자기 쪽 색으로 채워집니다. */
const SIDE = {
  a: { word: "this", name: "첫 번째", label: "hl-green", filled: "bg-green text-black", percent: "", bar: "bg-green" },
  b: { word: "that", name: "두 번째", label: "hl-black", filled: "bg-dark text-white", percent: "text-green", bar: "bg-dark" },
} as const;

function optionSize(text: string, hasImage: boolean): string {
  if (hasImage) return "text-p font-medium";
  const length = [...text].length;
  if (length <= 5) return "text-h3";
  if (length <= 12) return "text-title";
  return "text-p font-medium";
}

function OptionCard({
  side,
  option,
  percent,
  chosen,
  disabled,
  busy,
  delay,
  onPick,
}: {
  side: Choice;
  option: OptionView;
  percent: number | null;
  chosen: boolean;
  disabled: boolean;
  busy: boolean;
  delay: number;
  onPick: () => void;
}) {
  const tone = SIDE[side];
  const label = option.text ?? `${tone.name} 사진`;
  // 누르는 즉시 채워서, 서버 응답을 기다리는 동안에도 눌렸다는 걸 알 수 있게 합니다.
  const filled = chosen || busy;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={chosen}
      aria-label={percent === null ? `${label} 고르기` : `${label}, ${percent}퍼센트${chosen ? ", 내 선택" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
      className={`card pop-in flex min-h-48 flex-col text-left ${filled ? tone.filled : "bg-grey text-black"} ${
        disabled ? "" : "cursor-pointer"
      }`}
    >
      {option.image && (
        // 사용자가 올린 사진은 크기가 제각각이라 정사각형으로 잘라 보여줍니다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={option.image}
          alt={option.text ? "" : label}
          className="aspect-square w-full border-b border-dark bg-white object-cover"
        />
      )}
      <span className="flex flex-1 flex-col items-start gap-2.5 p-5">
        <span className="flex items-center gap-2">
          <span className={`hl text-h4 ${filled ? "hl-white" : tone.label}`}>{tone.word}</span>
          {chosen && <span className="text-p">내 선택</span>}
        </span>
        {option.text && <span className={optionSize(option.text, !!option.image)}>{option.text}</span>}
        {percent !== null && (
          <span className={`mt-auto text-h1 leading-none tabular-nums ${filled ? tone.percent : ""}`}>{percent}%</span>
        )}
      </span>
    </button>
  );
}

/** 두 보기 카드와 투표, 결과 막대. */
export function Board({ post, onChange }: { post: PostView; onChange: (post: PostView) => void }) {
  const [busy, setBusy] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  const revealed = post.counts !== null;
  const expired = post.closed || (post.expiresAt !== null && new Date(post.expiresAt).getTime() <= now);
  const canVote = post.myChoice === null && !expired;

  const onCounts = useCallback((counts: { a: number; b: number }) => onChange({ ...post, counts }), [post, onChange]);
  useLiveCounts(post.id, revealed && !expired, onCounts);

  async function pick(choice: Choice) {
    if (!canVote || busy) return;
    setBusy(choice);
    setError(null);
    try {
      const data = await api<{ post: PostView }>(`/api/posts/${post.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ choice }),
      });
      onChange(data.post);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "투표하지 못했습니다. 다시 눌러 주세요.");
    } finally {
      setBusy(null);
    }
  }

  const result = post.counts ? percents(post.counts) : null;
  const deadline = expired ? "마감됨" : remainingLabel(post.expiresAt, now);

  return (
    <section aria-label="보기">
      <div className="grid grid-cols-2 gap-[15px]">
        {(["a", "b"] as const).map((side, index) => (
          <OptionCard
            key={side}
            side={side}
            option={post[side]}
            percent={result && result.total > 0 ? result[side] : null}
            chosen={post.myChoice === side}
            disabled={!canVote || busy !== null}
            busy={busy === side}
            delay={index * 160}
            onPick={() => pick(side)}
          />
        ))}
      </div>

      {result ? (
        <div className="mt-[25px]">
          <div
            className="flex h-5 overflow-hidden rounded-md border border-dark bg-white"
            role="img"
            aria-label={result.total > 0 ? `this ${result.a}퍼센트, that ${result.b}퍼센트` : "아직 투표 없음"}
          >
            {/* 아직 표가 없으면 반반으로 보이지 않게 막대를 비워 둡니다. */}
            <div
              className={`${SIDE.a.bar} transition-[width] duration-700 ease-out`}
              style={{ width: `${result.total > 0 ? result.a : 0}%` }}
            />
            <div
              className={`${SIDE.b.bar} transition-[width] duration-700 ease-out`}
              style={{ width: `${result.total > 0 ? result.b : 0}%` }}
            />
          </div>
          <p className="mt-2.5 flex items-center justify-between gap-3 text-p">
            <span className="flex items-center gap-2">
              {!expired && <span className="live-dot size-2.5 rounded-full border border-dark bg-green" aria-hidden />}
              {result.total === 0
                ? "아직 투표가 없어요"
                : `${result.total.toLocaleString("ko-KR")}명 참여${expired ? "" : ", 실시간 반영 중"}`}
            </span>
            {deadline && <span className="shrink-0">{deadline}</span>}
          </p>
        </div>
      ) : (
        <p className="mt-[25px] flex items-center justify-between gap-3 text-p">
          <span>끌리는 쪽을 누르면 결과가 보여요</span>
          {deadline && <span className="shrink-0">{deadline}</span>}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-[15px] rounded-md border border-dark bg-grey px-5 py-[15px] text-p">
          {error}
        </p>
      )}
    </section>
  );
}

/** 릴이 도는 동안 보기 자리를 채우는 카드. */
export function MysteryBoard() {
  return (
    <div className="grid grid-cols-2 gap-[15px]" aria-hidden>
      {(["a", "b"] as const).map((side, index) => (
        <div key={side} className="card flex min-h-48 flex-col items-start bg-grey p-5">
          <span className={`hl text-h4 ${SIDE[side].label}`}>{SIDE[side].word}</span>
          <span className="mystery m-auto text-h1" style={{ animationDelay: `${index * 120}ms` }}>
            ?
          </span>
        </div>
      ))}
    </div>
  );
}
