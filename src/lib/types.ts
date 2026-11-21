export type Choice = "a" | "b";

/** DB의 posts 행 그대로. */
export type PostRow = {
  id: string;
  author_id: string;
  question: string;
  a_text: string | null;
  a_image: string | null;
  b_text: string | null;
  b_image: string | null;
  count_a: number;
  count_b: number;
  expires_at: string | null;
  created_at: string;
};

export type OptionView = { text: string | null; image: string | null };

/** 화면에 내려주는 포스팅. counts는 투표했거나, 마감됐거나, 내 글일 때만 채워집니다. */
export type PostView = {
  id: string;
  question: string;
  a: OptionView;
  b: OptionView;
  expiresAt: string | null;
  createdAt: string;
  closed: boolean;
  mine: boolean;
  myChoice: Choice | null;
  counts: { a: number; b: number } | null;
};

export type Me = { id: string; name: string; avatar: string | null };

export type VoteStatus = "ok" | "already" | "closed" | "not_found" | "ip_limit" | "invalid";

export const EXPIRY_OPTIONS = [
  { value: "none", label: "마감 없음", ms: 0 },
  { value: "1h", label: "1시간", ms: 60 * 60 * 1000 },
  { value: "24h", label: "24시간", ms: 24 * 60 * 60 * 1000 },
  { value: "3d", label: "3일", ms: 3 * 24 * 60 * 60 * 1000 },
  { value: "7d", label: "7일", ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

export type ExpiryValue = (typeof EXPIRY_OPTIONS)[number]["value"];

export const QUESTION_MAX = 100;
export const OPTION_TEXT_MAX = 40;
