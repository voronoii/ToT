"use client";

import { useMe } from "./me";

export function LoginPrompt({ next, title, body }: { next: string; title: string; body: string }) {
  const { demo } = useMe();
  return (
    <div className="mt-2.5 rounded-lg bg-grey px-[30px] py-10">
      <h1 className="text-h3">{title}</h1>
      <p className="mt-5 text-p">{body}</p>
      <a
        href={`/auth/login?next=${encodeURIComponent(next)}`}
        className="mt-[30px] flex items-center justify-center gap-2 rounded-[12px] bg-kakao px-5 py-5 text-label text-black/85"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path
            fill="currentColor"
            d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.27 4.66 6.67l-.96 3.52c-.08.3.26.55.52.37l4.2-2.78c.52.06 1.04.1 1.58.1 5.52 0 10-3.54 10-7.9S17.52 3 12 3z"
          />
        </svg>
        카카오 로그인
      </a>
      {demo && (
        <p className="mt-5 text-p">
          지금은 데모 모드입니다. 카카오 설정 전이라 체험용 계정으로 로그인됩니다.
        </p>
      )}
    </div>
  );
}
