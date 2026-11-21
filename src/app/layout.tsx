import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { Header } from "@/components/header";
import { MeProvider } from "@/components/me";
import "./globals.css";

// 영문·숫자용. 대체 글꼴을 끼워 넣지 않아야 한글이 곧바로 Pretendard로 넘어갑니다.
const spaceGrotesk = Space_Grotesk({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  adjustFontFallback: false,
  fallback: [],
});

// 한글용. 디자인 시스템에 들어 있는 Pretendard 1.3.9 (Regular, Medium).
const pretendard = localFont({
  src: [
    { path: "./fonts/Pretendard-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Pretendard-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-pretendard",
  display: "swap",
  adjustFontFallback: false,
  fallback: [],
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: { default: "this or that", template: "%s | this or that" },
  description: "둘 중에 뭘 고를지 모르겠을 때. 고민을 올리면 사람들이 대신 골라줍니다.",
  openGraph: { siteName: "this or that", type: "website", locale: "ko_KR" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${spaceGrotesk.variable} ${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full">
        <MeProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-5 pb-10">
            <Header />
            <main className="flex flex-1 flex-col">{children}</main>
          </div>
        </MeProvider>
      </body>
    </html>
  );
}
