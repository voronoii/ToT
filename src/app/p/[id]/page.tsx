import type { Metadata } from "next";
import { Suspense } from "react";
import { PostPage } from "@/components/post-page";
import { imageUrl, isPostId, store } from "@/lib/store";

type Props = PageProps<"/p/[id]">;

// 카카오톡 등에 링크를 붙였을 때 질문과 보기가 미리보기로 보이게 합니다.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const row = isPostId(id) ? await store.getPost(id) : null;
  if (!row) return { title: "없는 글" };
  const description = `${row.a_text ?? "사진"} vs ${row.b_text ?? "사진"}, 둘 중 하나를 골라주세요.`;
  const image = [row.a_image, row.b_image].map(imageUrl).find((url) => url?.startsWith("http"));
  return {
    title: row.question,
    description,
    openGraph: { title: row.question, description, images: image ? [image] : undefined },
  };
}

async function Post({ params }: Pick<Props, "params">) {
  const { id } = await params;
  return <PostPage id={id} />;
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <Post params={params} />
    </Suspense>
  );
}
