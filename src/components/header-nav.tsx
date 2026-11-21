"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "./me";

export function HeaderNav() {
  const { ready, user } = useMe();
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-[15px] text-p">
      {ready && user && pathname !== "/me" && (
        <Link href="/me" className="rounded-sm py-2">
          내 글
        </Link>
      )}
      {ready && !user && (
        <a href={`/auth/login?next=${encodeURIComponent(pathname)}`} className="rounded-sm py-2">
          로그인
        </a>
      )}
      {pathname !== "/new" && (
        // 모바일 머리줄에 맞춰 줄인 secondary 버튼.
        <Link href="/new" className="btn btn-secondary px-[15px] py-2 text-p">
          고민 올리기
        </Link>
      )}
    </nav>
  );
}
