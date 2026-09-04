import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "홍주형 — 포트폴리오",
  description: "홍주형의 최근 배움과 관심사를 소개하는 개인 포트폴리오. 비공개 영역은 패스키로 잠겨 있습니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="dark">
      <body>
        <a className="skip-link" href="#main">본문 바로가기</a>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">홍주형 · PORTFOLIO</Link>
            <nav>
              <Link href="/">공개 소개</Link>
              <Link href="/private">비공개 영역</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
