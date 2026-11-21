"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { shrinkImage, uploadImage } from "@/lib/image";
import {
  DEFAULT_EXPIRY,
  EXPIRY_OPTIONS,
  OPTION_TEXT_MAX,
  QUESTION_MAX,
  type Choice,
  type ExpiryValue,
} from "@/lib/types";
import { LoginPrompt } from "./login-prompt";
import { useMe } from "./me";

type Draft = { text: string; photo: Blob | null; preview: string | null };

const EMPTY: Draft = { text: "", photo: null, preview: null };
const SIDES = {
  a: { word: "this", label: "hl-green", name: "첫 번째 보기" },
  b: { word: "that", label: "hl-black", name: "두 번째 보기" },
} as const;

/** 디자인 시스템의 58px 원형 plus 아이콘. */
function PlusIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" aria-hidden>
      <circle cx="29" cy="29" r="28.5" className="fill-grey stroke-dark" />
      <path
        d="M25.6 41.08V31.36H16V25.72H25.6V16H31.48V25.72H41.08V31.36H31.48V41.08H25.6Z"
        className="fill-dark"
      />
    </svg>
  );
}

function OptionEditor({
  side,
  draft,
  onChange,
  onError,
}: {
  side: Choice;
  draft: Draft;
  onChange: (draft: Draft) => void;
  onError: (message: string) => void;
}) {
  const tone = SIDES[side];
  const input = useRef<HTMLInputElement>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    try {
      const photo = await shrinkImage(file);
      if (draft.preview) URL.revokeObjectURL(draft.preview);
      onChange({ ...draft, photo, preview: URL.createObjectURL(photo) });
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "사진을 처리하지 못했습니다.");
    }
  }

  function removePhoto() {
    if (draft.preview) URL.revokeObjectURL(draft.preview);
    onChange({ ...draft, photo: null, preview: null });
  }

  return (
    <div className="card flex flex-col bg-grey">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {draft.preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={draft.preview}
          alt={`${tone.name} 사진 미리보기`}
          className="aspect-square w-full border-b border-dark bg-white object-cover"
        />
      )}
      <div className="flex flex-col gap-2.5 p-5">
        <div className="flex items-center justify-between gap-1">
          <span className={`hl text-h4 ${tone.label}`}>{tone.word}</span>
          {draft.preview && (
            <button type="button" onClick={removePhoto} className="rounded-sm text-p underline underline-offset-4">
              사진 빼기
            </button>
          )}
        </div>
        {!draft.preview && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex flex-col items-center gap-[5px] rounded-md py-2.5 text-p"
          >
            <PlusIcon />
            사진 추가
          </button>
        )}
        <input
          value={draft.text}
          onChange={(event) => onChange({ ...draft, text: event.target.value })}
          maxLength={OPTION_TEXT_MAX}
          placeholder="글로 적기"
          aria-label={tone.name}
          enterKeyHint="next"
          className="field-input px-3 py-3 text-p"
        />
      </div>
    </div>
  );
}

export function NewForm() {
  const router = useRouter();
  const { ready, user } = useMe();
  const [question, setQuestion] = useState("");
  const [a, setA] = useState<Draft>(EMPTY);
  const [b, setB] = useState<Draft>(EMPTY);
  const [expiresIn, setExpiresIn] = useState<ExpiryValue>(DEFAULT_EXPIRY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 화면을 떠날 때 미리보기용 주소를 정리합니다.
  const previews = useRef<(string | null)[]>([]);
  useEffect(() => {
    previews.current = [a.preview, b.preview];
  });
  useEffect(() => () => previews.current.forEach((url) => url && URL.revokeObjectURL(url)), []);

  if (!ready) return null;
  if (!user) {
    return (
      <LoginPrompt
        next="/new"
        title="고민은 로그인하고 올려요"
        body="글쓰기는 카카오 로그인이 필요합니다. 투표는 로그인 없이도 할 수 있어요."
      />
    );
  }

  const count = [...question].length;
  const filled = (draft: Draft) => draft.text.trim() !== "" || draft.photo !== null;
  const complete = question.trim() !== "" && filled(a) && filled(b);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || sending) return;
    if (!complete) {
      setError("질문과 두 보기를 모두 채워 주세요. 보기는 글이나 사진 중 하나만 있어도 됩니다.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const [aImage, bImage] = await Promise.all(
        [a, b].map((draft) => (draft.photo ? uploadImage(draft.photo, user.id) : null)),
      );
      const { id } = await api<{ id: string }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({ question, aText: a.text, aImage, bText: b.text, bImage, expiresIn }),
      });
      router.push(`/p/${id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "올리지 못했습니다. 다시 시도하세요.");
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col pt-2.5">
      <h1 className="text-h2">
        <span className="hl hl-green">고민 올리기</span>
      </h1>

      <div className="mt-[30px] flex flex-col gap-[5px]">
        <div className="flex items-center justify-between">
          <label htmlFor="question" className="field-label">
            질문
          </label>
          <span className="field-label tabular-nums" aria-live="off">
            {count}/{QUESTION_MAX}
          </span>
        </div>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value.replace(/\n/g, " "))}
          maxLength={QUESTION_MAX}
          placeholder="예: 20대 친구 생일 선물, 뭐가 좋을까?"
          className="field-input h-[130px] resize-none"
        />
      </div>

      <div className="mt-[25px] grid grid-cols-2 items-start gap-[15px]">
        <OptionEditor side="a" draft={a} onChange={setA} onError={setError} />
        <OptionEditor side="b" draft={b} onChange={setB} onError={setError} />
      </div>

      <fieldset className="mt-[30px]">
        <legend className="field-label">투표 기한</legend>
        <div className="mt-[5px] flex flex-wrap gap-1.5">
          {EXPIRY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="cursor-pointer rounded-md px-2.5 py-2 text-p shadow-[inset_0_0_0_1px_var(--color-dark)] has-checked:bg-dark has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-dark"
            >
              <input
                type="radio"
                name="expiresIn"
                value={option.value}
                checked={expiresIn === option.value}
                onChange={() => setExpiresIn(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mt-5 rounded-md border border-dark bg-grey px-5 py-[15px] text-p">
          {error}
        </p>
      )}

      <div className="mt-auto pt-10">
        <button type="submit" disabled={sending} className="btn btn-primary w-full">
          {sending ? "올리는 중" : "고민 올리기"}
        </button>
      </div>
    </form>
  );
}
