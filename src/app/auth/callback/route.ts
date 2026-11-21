import { NextResponse, type NextRequest } from "next/server";
import { isDemo } from "@/lib/env";
import { safeNext, siteOrigin } from "@/lib/redirects";
import { createUserClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const origin = siteOrigin(request);
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");

  if (!isDemo && code) {
    const supabase = await createUserClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/?login=failed`);
}
