import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/** 로그인한 사용자의 세션 쿠키로 동작하는 클라이언트 (RLS 적용). */
export async function createUserClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // 쿠키를 쓸 수 없는 렌더링 단계에서는 무시합니다. 세션 갱신은 proxy가 맡습니다.
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;

/** secret 키 클라이언트 (RLS를 거치지 않음). 투표 집계처럼 RLS 밖에서 처리해야 하는 일에만 씁니다. */
export function createAdminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY 환경 변수가 없습니다.");
  admin ??= createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
