"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { COMMENT_MAX, type CommentView, type CommentsView } from "@/lib/types";

const SIDE = {
  a: { word: "this", label: "hl-green" },
  b: { word: "that", label: "hl-black" },
} as const;

/** 투표 결과가 보이는 사람에게만 그려지는 댓글 영역. */
export function Comments({ postId, expired }: { postId: string; expired: boolean }) {
  const [data, setData] = useState<CommentsView | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/posts/${postId}/comments`;

  useEffect(() => {
    let alive = true;
    api<CommentsView>(base)
      .then((loaded) => alive && setData(loaded))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [base]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      setData(await api<CommentsView>(base, { method: "POST", body: JSON.stringify({ text: trimmed }) }));
      setText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "댓글을 남기지 못했습니다. 다시 시도하세요.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(comment: CommentView) {
    const question = comment.mine ? "내 댓글을 지울까요? 지우면 다시 쓸 수 없습니다." : "이 댓글을 지울까요?";
    if (!window.confirm(question)) return;
    setError(null);
    try {
      setData(await api<CommentsView>(`${base}/${comment.id}`, { method: "DELETE" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "댓글을 지우지 못했습니다.");
    }
  }

  const inputId = `comment-${postId}`;
  const count = [...text].length;

  return (
    <section className="mt-10" aria-label="댓글">
      <div className="flex items-end justify-between">
        <h2 className="text-h3">
          <span className="hl hl-green">댓글</span>
        </h2>
        {data && data.total > 0 && <span className="text-p">{data.total.toLocaleString("ko-KR")}개</span>}
      </div>

      {failed && <p className="mt-5 text-p">댓글을 불러오지 못했습니다. 새로고침해 주세요.</p>}

      {data?.state === "open" && (
        <form onSubmit={submit} className="mt-5">
          <div className="flex items-center justify-between">
            <label htmlFor={inputId} className="field-label">
              한마디 남기기
            </label>
            <span className="field-label tabular-nums" aria-live="off">
              {count}/{COMMENT_MAX}
            </span>
          </div>
          <div className="mt-[5px] flex gap-2.5">
            <input
              id={inputId}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={COMMENT_MAX}
              placeholder={`${COMMENT_MAX}자까지`}
              enterKeyHint="send"
              autoComplete="off"
              className="field-input min-w-0 flex-1"
            />
            <button type="submit" disabled={busy} className="btn btn-secondary shrink-0 px-5 py-0">
              {busy ? "남기는 중" : "남기기"}
            </button>
          </div>
          <p className="mt-2.5 text-p">한 번만 쓸 수 있어요. 고칠 수 없고, 지우면 다시 쓸 수 없습니다.</p>
        </form>
      )}

      {data?.state === "login" && !expired && (
        <p className="mt-5 text-p">
          <a href={`/auth/login?next=${encodeURIComponent(`/p/${postId}`)}`} className="rounded-sm underline underline-offset-4">
            카카오 로그인
          </a>
          을 하고 투표하면 댓글을 남길 수 있어요.
        </p>
      )}
      {data?.state === "not_voted" && !expired && <p className="mt-5 text-p">투표하면 댓글을 남길 수 있어요.</p>}
      {data?.state === "deleted" && <p className="mt-5 text-p">내 댓글을 지웠어요. 다시 쓸 수는 없습니다.</p>}

      {error && (
        <p role="alert" className="mt-[15px] rounded-md border border-dark bg-grey px-5 py-[15px] text-p">
          {error}
        </p>
      )}

      {data && data.total === 0 && <p className="mt-5 text-p">아직 댓글이 없어요.</p>}

      {data && data.comments.length > 0 && (
        <ul className="mt-5 border-b border-dark">
          {data.comments.map((comment) => (
            <li key={comment.id} className="flex items-start gap-2.5 border-t border-dark py-[15px]">
              <span className={`hl min-w-[48px] text-center text-p ${SIDE[comment.choice].label}`}>{SIDE[comment.choice].word}</span>
              <div className="min-w-0 flex-1">
                <p className="text-h4">{comment.text}</p>
                <p className="text-p">
                  by. {comment.author ?? "이름 없음"}
                  {comment.mine && " (나)"}
                </p>
              </div>
              {(comment.mine || data.canModerate) && (
                <button
                  type="button"
                  onClick={() => remove(comment)}
                  aria-label={`${comment.text} 댓글 삭제`}
                  className="shrink-0 rounded-sm text-p underline underline-offset-4"
                >
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && data.total > data.comments.length && (
        <p className="mt-2.5 text-p">최근 {data.comments.length}개만 보여요.</p>
      )}
    </section>
  );
}
