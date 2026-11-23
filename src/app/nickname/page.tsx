import type { Metadata } from "next";
import { NicknameForm } from "@/components/nickname-form";

export const metadata: Metadata = { title: "닉네임" };

export default function Page() {
  return <NicknameForm />;
}
