import { NextResponse, type NextRequest } from "next/server";
import { isDemo } from "@/lib/env";
import { nicknameOrNull } from "@/lib/profile";
import { nicknamePath, safeNext, siteOrigin } from "@/lib/redirects";
import { createUserClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const origin = siteOrigin(request);
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");

  if (!isDemo && code) {
    const supabase = await createUserClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 처음 온 사람(닉네임을 아직 안 정한 사람)은 닉네임부터 정하고 원래 가려던 곳으로 갑니다.
      const named = data.user ? await nicknameOrNull(data.user.id) : null;
      return NextResponse.redirect(`${origin}${named ? next : nicknamePath(next)}`);
    }
  }
  return NextResponse.redirect(`${origin}/?login=failed`);
}
