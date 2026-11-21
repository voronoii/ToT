import type { Metadata } from "next";
import { NewForm } from "@/components/new-form";

export const metadata: Metadata = { title: "고민 올리기" };

export default function Page() {
  return <NewForm />;
}
