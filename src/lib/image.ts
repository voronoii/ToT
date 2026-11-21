"use client";

import { IMAGE_BUCKET, isDemo } from "@/lib/env";
import { getBrowserClient } from "@/lib/supabase/browser";

/** 휴대폰 사진은 수 MB라 올리기 전에 브라우저에서 줄입니다. */
export async function shrinkImage(file: File): Promise<Blob> {
  const max = isDemo ? 480 : 1080;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("이 사진은 열 수 없습니다. 다른 사진을 골라 주세요.");
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("사진을 처리하지 못했습니다.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("사진을 처리하지 못했습니다.");
  return blob;
}

/** 사진을 올리고, 글에 저장할 값을 돌려줍니다 (저장소 경로, 데모 모드에서는 data URL). */
export async function uploadImage(blob: Blob, userId: string): Promise<string> {
  if (isDemo) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("사진을 읽지 못했습니다."));
      reader.readAsDataURL(blob);
    });
  }
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await getBrowserClient()
    .storage.from(IMAGE_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error("사진을 올리지 못했습니다. 다시 시도하세요.");
  return path;
}
