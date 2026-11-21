import type { Metadata } from "next";
import { MyPosts } from "@/components/my-posts";

export const metadata: Metadata = { title: "내 글" };

export default function Page() {
  return <MyPosts />;
}
