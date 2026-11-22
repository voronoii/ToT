import Link from "next/link";
import { Suspense } from "react";
import { HeaderNav } from "./header-nav";
import { Logo } from "./logo";

export function Header() {
  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between">
      <Link href="/" className="rounded-sm" aria-label="this or that 홈">
        <Logo className="h-[56px] w-auto" />
      </Link>
      {/* 현재 경로와 로그인 상태에 따라 달라지는 부분만 따로 스트리밍합니다. */}
      <Suspense fallback={null}>
        <HeaderNav />
      </Suspense>
    </header>
  );
}
