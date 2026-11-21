import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_USER_COOKIE } from "@/lib/cookies";
import { isDemo } from "@/lib/env";
import { safeNext, siteOrigin } from "@/lib/redirects";
import { createUserClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const origin = siteOrigin(request);

  if (isDemo) {
    // 데모 모드: 카카오 없이 체험용 사용자로 로그인합니다.
    (await cookies()).set(DEMO_USER_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
    return NextResponse.redirect(`${origin}${next}`);
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) return NextResponse.redirect(`${origin}/?login=failed`);
  return NextResponse.redirect(data.url);
}
