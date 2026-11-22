import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemo, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import { VOTER_COOKIE, VOTER_COOKIE_OPTIONS } from "@/lib/cookies";

export async function proxy(request: NextRequest) {
  // 비회원 투표 중복을 막기 위한 브라우저 ID. 없으면 첫 요청에서 발급합니다.
  let newVoterId: string | null = null;
  if (!request.cookies.get(VOTER_COOKIE)) {
    newVoterId = crypto.randomUUID();
    request.cookies.set(VOTER_COOKIE, newVoterId);
  }

  let response = NextResponse.next({ request });

  if (!isDemo) {
    // 만료가 가까운 로그인 세션을 갱신해 쿠키에 다시 씁니다.
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    await supabase.auth.getClaims();
  }

  if (newVoterId) response.cookies.set(VOTER_COOKIE, newVoterId, VOTER_COOKIE_OPTIONS);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
