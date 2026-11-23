"use client";

import { useId, useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { cleanNickname, suggestNickname, tidyNickname } from "@/lib/nickname";
import { safeNext } from "@/lib/redirects";
import { NICKNAME_MAX } from "@/lib/types";
import { LoginPrompt } from "./login-prompt";
import { useMe } from "./me";

/** 가입 직후 닉네임을 정하는 화면. 나중에 "내 글"에서 다시 들어와 바꿀 때도 같은 화면을 씁니다. */
export function NicknameForm() {
  const { ready, user, nickname } = useMe();
  if (!ready) return null;
  if (!user) {
    return <LoginPrompt next="/nickname" title="닉네임은 로그인하면 정할 수 있어요" body="카카오로 로그인한 뒤 고민과 댓글에 보일 이름을 정합니다." />;
  }
  return <Form initial={nickname ?? suggestNickname(user.name)} first={nickname === null} />;
}

function Form({ initial, first }: { initial: string; first: boolean }) {
  const inputId = useId();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 저장될 모양(앞뒤 공백 없이, 이어진 공백은 한 칸)으로 세고 보여줍니다.
  const tidy = tidyNickname(value);
  const cleaned = cleanNickname(value);
  const length = [...tidy].length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!cleaned) {
      setError(`닉네임은 1자에서 ${NICKNAME_MAX}자까지 쓸 수 있습니다.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/me/nickname", { method: "PUT", body: JSON.stringify({ nickname: cleaned }) });
      // 머리줄과 다른 화면이 새 이름을 다시 읽도록 통째로 이동합니다.
      window.location.assign(safeNext(new URLSearchParams(window.location.search).get("next")));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장하지 못했습니다. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col pt-2.5">
      <h1 className="text-h2">
        <span className="hl hl-green">{first ? "닉네임 정하기" : "닉네임 바꾸기"}</span>
      </h1>
      <p className="mt-5 text-p">
        {first
          ? "고민과 댓글에 이 이름으로 보입니다. 카카오 이름 그대로 써도 되고, 여기서 바꿔도 됩니다."
          : "앞으로 올리는 고민과 댓글에 새 이름으로 보입니다. 이미 올린 것의 이름은 바뀌지 않습니다."}
      </p>

      <div className="mt-[30px] flex items-baseline justify-between">
        <label htmlFor={inputId} className="field-label">
          닉네임
        </label>
        <span className="field-label tabular-nums" aria-live="off">
          {length}/{NICKNAME_MAX}
        </span>
      </div>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        maxLength={NICKNAME_MAX * 2}
        autoComplete="nickname"
        enterKeyHint="done"
        className="field-input mt-1"
      />

      {/* 고민카드 아래쪽에 실제로 보이는 모양 그대로. */}
      <p className="on-dark mt-[15px] flex items-center justify-between gap-[15px] rounded-md bg-dark px-5 py-[15px] text-p text-white">
        <span className="min-w-0 truncate">by. {tidy || "닉네임"}</span>
        <span className="shrink-0 text-green">이렇게 보여요</span>
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-md border border-dark bg-grey px-5 py-[15px] text-p">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn btn-primary mt-[30px] w-full">
        {busy ? "저장하는 중" : first ? "이 이름으로 시작하기" : "저장하기"}
      </button>
    </form>
  );
}
