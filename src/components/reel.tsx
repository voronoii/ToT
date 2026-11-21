"use client";

import { useEffect, useState, type ReactNode } from "react";

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
    <div className="flex h-44 items-center justify-center px-[35px] text-center">
      <span className={questionSize(text)}>{text}</span>
    </div>
  );
}

/** 슬롯머신의 창. 안에 무엇을 보여줄지는 children으로 받습니다. */
export function ReelWindow({ children }: { children: ReactNode }) {
  return (
    <div className="on-dark relative mb-5 h-44 overflow-hidden rounded-lg bg-dark text-white">
      {children}
      <span
        className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 border-y-[9px] border-l-[11px] border-y-transparent border-l-green"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 border-y-[9px] border-r-[11px] border-y-transparent border-r-green"
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

/** 멈춘 릴: 실제 질문. */
export function ReelQuestion({ text }: { text: string }) {
  return (
    <h1 className="flex h-44 items-center justify-center px-[35px] text-center">
      <span className={questionSize(text)}>{text}</span>
    </h1>
  );
}
