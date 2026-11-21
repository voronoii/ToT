/** 브라우저에서 쓰는 공용 도우미. */

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !data) {
    throw new ApiError(data?.error ?? "연결이 불안정합니다. 잠시 후 다시 시도하세요.", response.status);
  }
  return data;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function remainingLabel(expiresAt: string | null, now: number): string | null {
  if (!expiresAt) return null;
  const left = new Date(expiresAt).getTime() - now;
  if (left <= 0) return "마감됨";
  const minutes = Math.ceil(left / 60_000);
  if (minutes < 60) return `${minutes}분 남음`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 남음`;
  return `${Math.floor(hours / 24)}일 남음`;
}

export function percents(counts: { a: number; b: number }): { a: number; b: number; total: number } {
  const total = counts.a + counts.b;
  if (total === 0) return { a: 50, b: 50, total };
  const a = Math.round((counts.a / total) * 100);
  return { a, b: 100 - a, total };
}
