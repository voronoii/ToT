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
  type LinkView,
  type PostQuota,
} from "@/lib/types";
import { LoginPrompt } from "./login-prompt";
import { useMe } from "./me";

type Draft = { text: string; link: string; photo: Blob | null; preview: string | null };

/** 붙여 넣은 링크가 어떻게 보일지 서버에 물어본 결과. url은 물어본 그 주소입니다. */
type LinkCheck = { url: string; status: "loading" | "failed" } | { url: string; status: "ready"; view: LinkView };

const LOOKS_LIKE_LINK = /^https?:\/\/\S+\.\S+$/i;

const EMPTY: Draft = { text: "", link: "", photo: null, preview: null };
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

  // 링크를 붙여 넣으면 잠깐 기다렸다가 미리보기를 받아옵니다.
  const [check, setCheck] = useState<LinkCheck | null>(null);
  const url = draft.link.trim();
  useEffect(() => {
    if (!LOOKS_LIKE_LINK.test(url)) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setCheck({ url, status: "loading" });
      api<{ link: LinkView }>("/api/link-preview", { method: "POST", body: JSON.stringify({ url }) })
        .then((data) => alive && setCheck({ url, status: "ready", view: data.link }))
        .catch(() => alive && setCheck({ url, status: "failed" }));
    }, 500);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [url]);
  // 주소를 고치는 중이면 예전 결과는 보여주지 않습니다.
  const current = check && check.url === url ? check : null;
  const linkView = current?.status === "ready" ? current.view : null;
  const linkImage = draft.preview ? null : (linkView?.image ?? null);

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
      {(draft.preview || linkImage) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={draft.preview ?? linkImage ?? undefined}
          alt={draft.preview ? `${tone.name} 사진 미리보기` : `${tone.name} 링크의 대표 사진`}
          referrerPolicy="no-referrer"
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
          {linkImage && (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="rounded-sm text-p underline underline-offset-4"
            >
              내 사진
            </button>
          )}
        </div>
        {!draft.preview && !linkImage && (
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
          onChange={(event) => {
            const value = event.target.value;
            // 글 칸에 주소를 붙여 넣으면 링크 칸으로 옮깁니다.
            if (!draft.link && LOOKS_LIKE_LINK.test(value.trim())) onChange({ ...draft, text: "", link: value.trim() });
            else onChange({ ...draft, text: value });
          }}
          maxLength={OPTION_TEXT_MAX}
          placeholder="글로 적기"
          aria-label={tone.name}
          enterKeyHint="next"
          className="field-input px-3 py-3 text-p"
        />
        <input
          value={draft.link}
          onChange={(event) => onChange({ ...draft, link: event.target.value })}
          maxLength={500}
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="링크 붙이기"
          aria-label={`${tone.name} 링크`}
          enterKeyHint="next"
          className="field-input px-3 py-3 text-p"
        />
        {url !== "" && (
          <p className="text-p" aria-live="polite">
            {!LOOKS_LIKE_LINK.test(url) && "http로 시작하는 주소를 넣어 주세요."}
            {current?.status === "loading" && "미리보기 가져오는 중"}
            {current?.status === "failed" && "주소를 확인해 주세요."}
            {linkView && (
              <>
                {linkView.title && <span className="line-clamp-2 font-medium">{linkView.title}</span>}
                <span className="block truncate">{linkView.host}</span>
                {!linkView.title && !linkView.image && <span className="block">미리보기가 없는 링크예요.</span>}
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** 다시 올릴 수 있을 때까지 남은 시간을 말로. */
function waitLabel(nextAt: string | null): string {
  if (!nextAt) return "조금 뒤에";
  const minutes = Math.max(1, Math.ceil((new Date(nextAt).getTime() - Date.now()) / 60_000));
  return minutes < 60 ? `약 ${minutes}분 뒤에` : `약 ${Math.ceil(minutes / 60)}시간 뒤에`;
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

  // 오늘 몇 개 더 올릴 수 있는지. 못 받아와도 글쓰기는 막지 않고, 서버가 최종 판정합니다.
  const [quota, setQuota] = useState<PostQuota | null>(null);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    api<PostQuota>("/api/me/quota")
      .then((data) => alive && setQuota(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

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
  const filled = (draft: Draft) => draft.text.trim() !== "" || draft.link.trim() !== "" || draft.photo !== null;
  const complete = question.trim() !== "" && filled(a) && filled(b);
  const spent = quota?.remaining === 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || sending || spent) return;
    if (!complete) {
      setError("질문과 두 보기를 모두 채워 주세요. 보기는 글, 사진, 링크 중 하나만 있어도 됩니다.");
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
        body: JSON.stringify({
          question,
          aText: a.text,
          aImage,
          aLink: a.link,
          bText: b.text,
          bImage,
          bLink: b.link,
          expiresIn,
        }),
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
        {quota && (
          <p className="mb-[15px] text-p">
            {spent
              ? `24시간 동안 올릴 수 있는 ${quota.limit}개를 모두 올렸어요. ${waitLabel(quota.nextAt)} 다시 올릴 수 있습니다.`
              : `고민은 24시간 동안 ${quota.limit}개까지 올릴 수 있어요. 지금 ${quota.remaining}개 남았습니다.`}
          </p>
        )}
        <button type="submit" disabled={sending || spent} className="btn btn-primary w-full">
          {spent ? "지금은 올릴 수 없어요" : sending ? "올리는 중" : "고민 올리기"}
        </button>
      </div>
    </form>
  );
}
