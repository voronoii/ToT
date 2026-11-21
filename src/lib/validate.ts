import "server-only";

import { isDemo } from "@/lib/env";
import type { NewPost } from "@/lib/store";
import { DEFAULT_EXPIRY, EXPIRY_OPTIONS, OPTION_TEXT_MAX, QUESTION_MAX } from "@/lib/types";

const length = (value: string) => [...value].length;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed === "" ? null : trimmed;
}

function image(value: unknown, userId: string): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  if (isDemo) {
    return /^data:image\/(jpeg|webp|png);base64,/.test(value) && value.length <= 600_000 ? value : undefined;
  }
  // 본인 폴더에 올린 사진 경로만 허용합니다 (DB 정책에서도 한 번 더 확인).
  const [folder, file, ...rest] = value.split("/");
  const ok = rest.length === 0 && folder === userId && /^[A-Za-z0-9-]{8,64}\.(jpg|webp|png)$/.test(file ?? "");
  return ok ? value : undefined;
}

export function parseNewPost(body: unknown, userId: string): { post: NewPost } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "요청 형식이 올바르지 않습니다." };
  const input = body as Record<string, unknown>;

  const question = text(input.question);
  if (!question) return { error: "질문을 입력하세요." };
  if (length(question) > QUESTION_MAX) return { error: `질문은 ${QUESTION_MAX}자까지 쓸 수 있습니다.` };

  const aText = text(input.aText);
  const bText = text(input.bText);
  if ((aText && length(aText) > OPTION_TEXT_MAX) || (bText && length(bText) > OPTION_TEXT_MAX)) {
    return { error: `보기는 ${OPTION_TEXT_MAX}자까지 쓸 수 있습니다.` };
  }

  const aImage = image(input.aImage, userId);
  const bImage = image(input.bImage, userId);
  if (aImage === undefined || bImage === undefined) return { error: "사진을 다시 올려 주세요." };

  if (!aText && !aImage) return { error: "첫 번째 보기에 글이나 사진을 넣으세요." };
  if (!bText && !bImage) return { error: "두 번째 보기에 글이나 사진을 넣으세요." };

  // 기한은 6시간 또는 하루뿐이고, 값이 없거나 이상하면 하루로 둡니다.
  const chosen = input.expiresIn ?? DEFAULT_EXPIRY;
  const expiry = EXPIRY_OPTIONS.find((option) => option.value === chosen);
  if (!expiry) return { error: "투표 기한은 6시간 또는 하루 중에서 고르세요." };
  const expiresAt = new Date(Date.now() + expiry.ms).toISOString();

  return { post: { question, aText, aImage, bText, bImage, expiresAt } };
}
