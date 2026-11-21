export type Choice = "a" | "b";

/** DB의 posts 행 그대로. */
export type PostRow = {
  id: string;
  author_id: string;
  /** 글을 쓸 때의 표시 이름. 이 컬럼이 생기기 전 글은 null. */
  author_name: string | null;
  question: string;
  a_text: string | null;
  a_image: string | null;
  b_text: string | null;
  b_image: string | null;
  /** 보기에 붙인 링크와, 글을 올릴 때 받아 둔 미리보기({title, image}). */
  a_link: string | null;
  b_link: string | null;
  a_link_meta: unknown;
  b_link_meta: unknown;
  count_a: number;
  count_b: number;
  expires_at: string | null;
  created_at: string;
};

/** 링크 미리보기: 그 페이지가 스스로 밝힌 제목과 대표 사진. */
export type LinkMeta = { title: string | null; image: string | null };

/** 화면에 내려주는 링크. host는 링크 주소에서 뽑은 사이트 이름입니다. */
export type LinkView = { url: string; host: string } & LinkMeta;

export type OptionView = { text: string | null; image: string | null; link: LinkView | null };

/** 화면에 내려주는 포스팅. counts는 투표했거나, 마감됐거나, 내 글일 때만 채워집니다. */
export type PostView = {
  id: string;
  question: string;
  /** 글쓴이 표시 이름. */
  author: string | null;
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

/** 투표 기한. 모든 고민은 기한이 있고, 길어야 하루입니다. */
export const EXPIRY_OPTIONS = [
  { value: "6h", label: "6시간", ms: 6 * 60 * 60 * 1000 },
  { value: "24h", label: "하루", ms: 24 * 60 * 60 * 1000 },
] as const;
export const DEFAULT_EXPIRY = "24h" satisfies (typeof EXPIRY_OPTIONS)[number]["value"];

export type ExpiryValue = (typeof EXPIRY_OPTIONS)[number]["value"];

export const QUESTION_MAX = 100;
export const OPTION_TEXT_MAX = 40;
export const AUTHOR_NAME_MAX = 40;
export const COMMENT_MAX = 15;

/** DB votes 행에서 댓글에 필요한 부분. */
export type CommentRow = {
  comment_id: string;
  comment: string;
  comment_author: string | null;
  choice: Choice;
  commented_at: string;
  voter_key: string;
};

export type CommentView = {
  id: string;
  text: string;
  author: string | null;
  /** 이 댓글을 쓴 사람이 고른 쪽. */
  choice: Choice;
  createdAt: string;
  mine: boolean;
};

/**
 * 보는 사람이 이 글에 댓글을 쓸 수 있는지.
 * login: 로그인 필요 · not_voted: 아직 투표 전 · open: 쓸 수 있음 · written: 이미 씀 · deleted: 썼다가 지움(재작성 불가)
 */
export type CommentState = "login" | "not_voted" | "open" | "written" | "deleted";

export type CommentsView = {
  /** 최근 댓글부터 한 쪽(20개). */
  comments: CommentView[];
  /** 더 오래된 댓글이 남아 있으면, 다음 쪽을 부를 때 넘길 기준 시각. 없으면 null. */
  nextBefore: string | null;
  total: number;
  state: CommentState;
  /** 고민 글쓴이는 자기 글에 달린 댓글을 지울 수 있습니다. */
  canModerate: boolean;
};
