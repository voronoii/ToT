"use client";

import { useState } from "react";

export function ShareButton({ postId, question, className = "" }: { postId: string; question: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/p/${postId}`;
    if (navigator.share) {
      // 휴대폰에서는 공유 시트가 열려 카카오톡 등으로 바로 보낼 수 있습니다.
      await navigator.share({ title: "this or that", text: question, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("이 링크를 복사하세요", url);
    }
  }

  return (
    <button type="button" onClick={share} className={`btn btn-secondary px-5 ${className}`}>
      {copied ? "링크 복사됨" : "공유하기"}
    </button>
  );
}
