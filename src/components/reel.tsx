"use client";

import { useEffect, useState, type ReactNode } from "react";
import { remainingLabel } from "@/lib/client";
import { useNow } from "@/lib/live";

/*
 * 릴 창은 높이가 고정입니다. 질문은 위쪽 영역 가운데에 놓고, 아래 띠는 글쓴이·마감 줄을 위해 비워 둡니다.
 * 안내 문구만 보여줄 때(plain)는 아래 띠 없이 창 한가운데에 놓습니다.
 */
const SLIDE = "flex h-[216px] items-center justify-center px-[35px] pt-5 pb-[52px] text-center";
const SLIDE_PLAIN = "flex h-[216px] items-center justify-center px-[35px] py-5 text-center";

/** 질문 길이에 맞춰 글자 크기를 정합니다. 릴 창 높이는 고정입니다. */
export function questionSize(text: string): string {
  const length = [...text].length;
  if (length <= 22) return "text-h3";
  if (length <= 46) return "text-title";
  if (length <= 76) return "text-h4";
  return "text-p font-medium";
}

function Slide({ text }: { text: string }) {
  return (
    <div className={SLIDE}>
      <span className={questionSize(text)}>{text}</span>
    </div>
  );
}

/** 슬롯머신의 창. 안에 무엇을 보여줄지는 children으로 받습니다. */
export function ReelWindow({ children, plain = false }: { children?: ReactNode; plain?: boolean }) {
  // 양옆 표시는 질문이 놓이는 높이에 맞춥니다.
  const marker = plain ? "top-1/2" : "top-[92px]";
  return (
    <div className="on-dark relative mb-5 h-[216px] overflow-hidden rounded-lg bg-dark text-white">
      {children}
      <span
        className={`pointer-events-none absolute left-0 ${marker} -translate-y-1/2 border-y-[9px] border-l-[11px] border-y-transparent border-l-green`}
        aria-hidden
      />
      <span
        className={`pointer-events-none absolute right-0 ${marker} -translate-y-1/2 border-y-[9px] border-r-[11px] border-y-transparent border-r-green`}
        aria-hidden
      />
    </div>
  );
}

/** 결과를 기다리는 동안 끝없이 도는 릴. */
export function ReelLoop({ items }: { items: string[] }) {
  return (
    <div className="reel-loop" aria-hidden>
      {[...items, ...items].map((text, index) => (
        <Slide key={index} text={text} />
      ))}
    </div>
  );
}

/** 마지막 항목에서 감속하며 멈추는 릴. */
export function ReelLanding({ items, onLanded }: { items: string[]; onLanded: () => void }) {
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setMoving(true));
    });
    // 탭이 가려져 transitionend가 오지 않아도 멈춘 상태로 넘어가게 합니다.
    const fallback = window.setTimeout(onLanded, 1900);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      window.clearTimeout(fallback);
    };
  }, [onLanded]);

  const offset = ((items.length - 1) / items.length) * 100;
  return (
    <div
      className={moving ? "reel-land" : undefined}
      style={{ transform: `translateY(-${moving ? offset : 0}%)` }}
      onTransitionEnd={(event) => event.target === event.currentTarget && onLanded()}
      aria-hidden
    >
      {items.map((text, index) => (
        <Slide key={index} text={text} />
      ))}
    </div>
  );
}

/** 멈춘 릴: 실제 질문. plain은 아래 띠 없이 안내 문구만 보여줄 때 씁니다. */
export function ReelQuestion({ text, plain = false }: { text: string; plain?: boolean }) {
  return (
    <h1 className={plain ? SLIDE_PLAIN : SLIDE}>
      <span className={questionSize(text)}>{text}</span>
    </h1>
  );
}

/** 고민카드 하단: 왼쪽에 글쓴이, 오른쪽에 마감 기한. 포스팅을 받아온 뒤에만 그립니다. */
export function ReelFooter({
  author,
  expiresAt,
  closed,
}: {
  author: string | null;
  expiresAt: string | null;
  closed: boolean;
}) {
  const now = useNow();
  const deadline = closed ? "마감됨" : remainingLabel(expiresAt, now);
  if (!author && !deadline) return null;
  return (
    <p className="absolute inset-x-[35px] bottom-5 flex items-center justify-between gap-[15px] text-p">
      <span className="min-w-0 truncate">{author && `by. ${author}`}</span>
      {deadline && <span className="shrink-0 text-green">{deadline}</span>}
    </p>
  );
}
