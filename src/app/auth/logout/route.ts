import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_USER_COOKIE } from "@/lib/cookies";
import { isDemo } from "@/lib/env";
import { siteOrigin } from "@/lib/redirects";
import { createUserClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (isDemo) {
    (await cookies()).delete(DEMO_USER_COOKIE);
  } else {
    const supabase = await createUserClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(`${siteOrigin(request)}/`, { status: 303 });
}
