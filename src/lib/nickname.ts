import { NICKNAME_MAX } from "@/lib/types";

/** 닉네임을 다듬습니다: 줄바꿈 같은 제어 문자를 빼고, 이어진 공백은 한 칸으로. */
export const tidyNickname = (value: string) =>
  value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** 다듬은 닉네임. 비었거나 너무 길어 쓸 수 없으면 null. */
export function cleanNickname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = tidyNickname(value);
  const length = [...cleaned].length;
  return length >= 1 && length <= NICKNAME_MAX ? cleaned : null;
}

/** 닉네임 칸에 처음 채워 둘 값: 카카오 닉네임을 길이에 맞춰 자른 것. */
export const suggestNickname = (name: string) => cleanNickname([...name.trim()].slice(0, NICKNAME_MAX).join("")) ?? "";
