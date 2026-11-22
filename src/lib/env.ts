export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Supabase 설정이 없으면 데모 모드로 동작합니다.
 * 데모 모드: 서버 메모리에 샘플 포스팅을 두고, 카카오 대신 체험용 로그인을 씁니다.
 */
export const isDemo = !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY;

export const IMAGE_BUCKET = "option-images";
