import "server-only";

import { randomUUID } from "node:crypto";
import { POST_DAILY_LIMIT, POST_LIMIT_WINDOW_MS, type Choice, type CommentRow, type PostRow } from "@/lib/types";
import { PostLimitError, type Store } from "./index";

/** 데모 모드용 저장소. 서버 메모리에만 있어 재시작하면 처음 상태로 돌아갑니다. */

type Vote = {
  choice: Choice;
  ipHash: string | null;
  comment?: string | null;
  commentAuthor?: string | null;
  commentId?: string;
  /** 댓글을 지워도 남습니다 (다시 쓸 수 없음). */
  commentedAt?: string;
};
type State = {
  posts: Map<string, PostRow>;
  votes: Map<string, Map<string, Vote>>;
  /** 글을 올린 기록. 글을 지워도 남습니다 (하루 3개 제한용). */
  postLog?: Map<string, number[]>;
  /** 직접 정한 닉네임. */
  nicknames?: Map<string, string>;
};

const SEED_AUTHOR = "00000000-0000-4000-8000-0000000005ed";

/** 데모용 사진 자리: 디자인 시스템 색으로 그린 선화. 실제 서비스에서는 사용자가 올린 사진이 들어갑니다. */
function picture(shapes: string, background: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${background}"/><g fill="none" stroke="#191a23" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">${shapes}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const WHITE = "#ffffff";
const GREEN = "#b9ff66";
const ART = {
  headphones: `<path d="M110 230v-40a90 90 0 0 1 180 0v40"/><rect x="90" y="220" width="50" height="90" rx="20" fill="${GREEN}"/><rect x="260" y="220" width="50" height="90" rx="20" fill="${GREEN}"/>`,
  watch: `<path d="M160 130l10-60h60l10 60M160 270l10 60h60l10-60"/><rect x="130" y="130" width="140" height="140" rx="40" fill="${WHITE}"/><path d="M200 165v40l28 18"/>`,
  gate: `<path d="M90 120q110 30 220 0M110 170h180M140 135v195M260 135v195"/>`,
  beach: `<circle cx="200" cy="150" r="55" fill="${WHITE}"/><path d="M70 270q32-30 65 0t65 0 65 0 65 0M70 320q32-30 65 0t65 0 65 0 65 0"/>`,
  vacuum: `<circle cx="200" cy="200" r="110" fill="${GREEN}"/><circle cx="200" cy="200" r="42" fill="${WHITE}"/><path d="M200 108v-10"/>`,
  fryer: `<rect x="120" y="80" width="160" height="240" rx="45" fill="${WHITE}"/><path d="M120 200h160M175 255h50"/><circle cx="200" cy="140" r="22"/>`,
};

type Seed = [author: string, question: string, a: [string | null, string | null], b: [string | null, string | null], countA: number, countB: number];

const SEEDS: Seed[] = [
  ["선물 고르는 중", "20대 친구 생일 선물, 뭐가 더 좋을까?", ["무선 이어폰", picture(ART.headphones, WHITE)], ["스마트 워치", picture(ART.watch, GREEN)], 128, 97],
  ["혼밥 만렙", "오늘 저녁 혼밥 메뉴 골라줘", ["마라탕", null], ["제육볶음", null], 54, 61],
  ["여행 초보", "첫 해외여행, 어디가 나을까?", ["오사카", picture(ART.gate, GREEN)], ["다낭", picture(ART.beach, GREEN)], 203, 177],
  ["소개팅 하루 전", "소개팅 첫 만남 장소는?", ["조용한 카페", null], ["분위기 좋은 식당", null], 88, 143],
  ["퇴근 요정", "퇴근하고 운동 하나만 한다면", ["헬스", null], ["러닝", null], 71, 66],
  ["주말엔 영화", "이번 주말에 볼 영화 장르", ["심장 쫄깃한 스릴러", null], ["아무 생각 없는 코미디", null], 39, 52],
  ["자취 3년 차", "자취방에 하나만 들인다면?", ["로봇청소기", picture(ART.vacuum, WHITE)], ["에어프라이어", picture(ART.fryer, GREEN)], 112, 160],
  ["취준생", "면접 날 뭐 입지", ["정장 풀세트", null], ["단정한 셔츠에 슬랙스", null], 47, 119],
  ["먹는 게 낙", "평생 하나만 먹어야 한다면", ["떡볶이", null], ["치킨", null], 301, 412],
];

const MANY_COMMENTS: [choice: Choice, author: string, comment: string][] = [
  ["a", "분식집 딸", "떡볶이는 소울푸드"],
  ["b", "야구 보는 날", "치킨엔 맥주가 있음"],
  ["a", "밀떡파", "밀떡이면 평생 가능"],
  ["b", "반반 무많이", "양념 후라이드 반반"],
  ["a", "쌀떡파", "쌀떡도 인정합니다"],
  ["b", "닭다리 두 개", "닭다리는 못 참지"],
  ["a", "순대도 같이", "튀김 찍어 먹으면 끝"],
  ["b", "퍽퍽살 좋아", "가슴살도 맛있어요"],
  ["a", "로제 좋아", "로제도 떡볶이니까"],
  ["b", "간장파", "간장치킨이 진리"],
  ["a", "국물파", "국물에 밥 비벼야지"],
  ["b", "치밥", "남은 건 치밥으로"],
  ["a", "학교 앞", "학교 앞 그 맛"],
  ["b", "새벽 배달", "새벽엔 역시 치킨"],
  ["a", "매운 거 최고", "매운 게 당길 때"],
  ["b", "뼈 있는 걸로", "순살은 치킨이 아님"],
  ["a", "오뎅 추가", "오뎅 국물은 덤"],
  ["b", "순살파", "순살이 편하잖아요"],
  ["a", "즉떡", "즉석떡볶이 볶음밥"],
  ["b", "파닭", "파닭 드셔 보세요"],
  ["a", "치즈 추가", "치즈 올리면 끝남"],
  ["b", "마늘치킨", "마늘 듬뿍이 좋아요"],
  ["a", "라볶이", "라면사리는 필수"],
  ["b", "옛날통닭", "시장 통닭 한 마리"],
];

const SEED_COMMENTS: [postIndex: number, choice: Choice, author: string, comment: string][] = [
  [0, "a", "출퇴근 두 시간", "이어폰은 매일 써요"],
  [0, "b", "얼리어답터", "워치는 받아야 써 봄"],
  [0, "a", "막귀", "소리는 거기서 거기"],
  [1, "a", "맵부심", "마라탕은 2단계부터"],
  [1, "b", "한식파", "제육은 실패가 없지"],
  [8, "b", "1일 1닭", "치킨은 종류가 많음"],
  // "더 보기"를 볼 수 있게, 마지막 글에는 한 쪽(20개)을 넘기는 댓글을 둡니다.
  ...MANY_COMMENTS.map(([choice, author, comment]) => [8, choice, author, comment] as [number, Choice, string, string]),
];

function seed(): State {
  const posts = new Map<string, PostRow>();
  const now = Date.now();
  SEEDS.forEach(([author, question, a, b, countA, countB], index) => {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    posts.set(id, {
      id,
      author_id: SEED_AUTHOR,
      author_name: author,
      question,
      a_text: a[0],
      a_image: a[1],
      b_text: b[0],
      b_image: b[1],
      a_link: null,
      b_link: null,
      a_link_meta: null,
      b_link_meta: null,
      count_a: countA,
      count_b: countB,
      // 모든 고민은 기한이 있습니다. 데모에서는 남은 시간이 고르게 보이도록 2~18시간으로 흩어 둡니다.
      expires_at: new Date(now + (index + 1) * 2 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now - index * 37 * 60 * 1000).toISOString(),
    });
  });
  // 댓글이 달린 모습을 볼 수 있게 몇 개 넣어 둡니다. [글 번호, 고른 쪽, 이름, 댓글]
  const votes = new Map<string, Map<string, Vote>>();
  SEED_COMMENTS.forEach(([postIndex, choice, author, comment], index) => {
    const id = `00000000-0000-4000-8000-${String(postIndex + 1).padStart(12, "0")}`;
    const postVotes = votes.get(id) ?? new Map<string, Vote>();
    votes.set(id, postVotes);
    postVotes.set(`u:seed-${index}`, {
      choice,
      ipHash: null,
      comment,
      commentAuthor: author,
      commentId: randomUUID(),
      commentedAt: new Date(now - (index + 1) * 11 * 60 * 1000).toISOString(),
    });
  });
  return { posts, votes };
}

const holder = globalThis as typeof globalThis & { __totDemoState?: State };
const state = () => (holder.__totDemoState ??= seed());

/** 최근 24시간 안에 이 사람이 글을 올린 시각들 (오래된 것부터). */
function recentPosts(authorId: string): number[] {
  const current = state();
  const log = (current.postLog ??= new Map<string, number[]>());
  const recent = (log.get(authorId) ?? []).filter((time) => time > Date.now() - POST_LIMIT_WINDOW_MS);
  log.set(authorId, recent);
  return recent;
}

const isOpen = (post: PostRow) => post.expires_at === null || new Date(post.expires_at).getTime() > Date.now();

export const memoryStore: Store = {
  async feed(voterKey, exclude, limit) {
    const { posts, votes } = state();
    const candidates = [...posts.values()].filter(
      (post) => isOpen(post) && !exclude.includes(post.id) && !votes.get(post.id)?.has(voterKey),
    );
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates.slice(0, limit).map((post) => ({ ...post }));
  },

  async getPost(id) {
    const post = state().posts.get(id);
    return post ? { ...post } : null;
  },

  async getChoices(voterKey, postIds) {
    const choices: Record<string, Choice> = {};
    for (const id of postIds) {
      const vote = state().votes.get(id)?.get(voterKey);
      if (vote) choices[id] = vote.choice;
    }
    return choices;
  },

  async vote(postId, choice, voterKey, ipHash) {
    const { posts, votes } = state();
    const post = posts.get(postId);
    if (!post) return { status: "not_found", myChoice: null, countA: 0, countB: 0 };
    const postVotes = votes.get(postId) ?? new Map<string, Vote>();
    votes.set(postId, postVotes);
    const existing = postVotes.get(voterKey);
    if (existing) return { status: "already", myChoice: existing.choice, countA: post.count_a, countB: post.count_b };
    if (!isOpen(post)) return { status: "closed", myChoice: null, countA: post.count_a, countB: post.count_b };
    postVotes.set(voterKey, { choice, ipHash });
    if (choice === "a") post.count_a += 1;
    else post.count_b += 1;
    return { status: "ok", myChoice: choice, countA: post.count_a, countB: post.count_b };
  },

  async createPost(author, input) {
    const recent = recentPosts(author.id);
    if (recent.length >= POST_DAILY_LIMIT) throw new PostLimitError();
    recent.push(Date.now());
    const id = randomUUID();
    state().posts.set(id, {
      id,
      author_id: author.id,
      author_name: author.name,
      question: input.question,
      a_text: input.aText,
      a_image: input.aImage,
      b_text: input.bText,
      b_image: input.bImage,
      a_link: input.aLink,
      b_link: input.bLink,
      a_link_meta: input.aLinkMeta,
      b_link_meta: input.bLinkMeta,
      count_a: 0,
      count_b: 0,
      expires_at: input.expiresAt,
      created_at: new Date().toISOString(),
    });
    return id;
  },

  async recentPostTimes(authorId) {
    return recentPosts(authorId).map((time) => new Date(time).toISOString());
  },

  async listByAuthor(authorId) {
    return [...state().posts.values()]
      .filter((post) => post.author_id === authorId)
      .sort((x, y) => y.created_at.localeCompare(x.created_at))
      .map((post) => ({ ...post }));
  },

  async deletePost(authorId, id) {
    const { posts, votes } = state();
    if (posts.get(id)?.author_id !== authorId) return false;
    posts.delete(id);
    votes.delete(id);
    return true;
  },

  async listComments(postId, limit, before) {
    const rows: CommentRow[] = [];
    for (const [voterKey, vote] of state().votes.get(postId) ?? []) {
      if (vote.comment && vote.commentId && vote.commentedAt) {
        rows.push({
          comment_id: vote.commentId,
          comment: vote.comment,
          comment_author: vote.commentAuthor ?? null,
          choice: vote.choice,
          commented_at: vote.commentedAt,
          voter_key: voterKey,
        });
      }
    }
    rows.sort((x, y) => y.commented_at.localeCompare(x.commented_at));
    const page = before ? rows.filter((row) => row.commented_at < before) : rows;
    return { rows: page.slice(0, limit), total: rows.length };
  },

  async getCommentStatus(postId, voterKey) {
    const vote = state().votes.get(postId)?.get(voterKey);
    return vote ? { used: !!vote.commentedAt, active: !!vote.comment } : null;
  },

  async addComment(postId, voterKey, authorName, text) {
    const vote = state().votes.get(postId)?.get(voterKey);
    if (!vote) return "not_voted";
    if (vote.commentedAt) return "already";
    Object.assign(vote, {
      comment: text,
      commentAuthor: authorName,
      commentId: randomUUID(),
      commentedAt: new Date().toISOString(),
    });
    return "ok";
  },

  async deleteComment(postId, commentId, onlyVoterKey) {
    for (const [voterKey, vote] of state().votes.get(postId) ?? []) {
      if (vote.commentId !== commentId || !vote.comment) continue;
      if (onlyVoterKey && voterKey !== onlyVoterKey) return false;
      vote.comment = null;
      vote.commentAuthor = null;
      return true;
    }
    return false;
  },

  async getNickname(userId) {
    return state().nicknames?.get(userId) ?? null;
  },

  async setNickname(userId, nickname) {
    const current = state();
    (current.nicknames ??= new Map<string, string>()).set(userId, nickname);
  },
};
