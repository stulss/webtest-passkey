import Link from "next/link";
import { Hero, Strengths, Projects, TechStack, Disclosure } from "./portfolio-sections";

// 공개 소개 페이지. 서버 컴포넌트이며 비공개 자료를 조회하지 않는다.
// 로그인 여부와 무관하게 누구나 같은 내용을 본다.
export default function HomePage() {
  return (
    <>
      <Hero />
      <main id="main">
        <Strengths />
        <Projects />
        <TechStack />
        <Disclosure />
        <section className="section">
          <div className="container">
            <h2>비공개 영역</h2>
            <p className="section-desc">
              준비 중인 메모처럼 나만 보는 자리입니다. 비밀번호 없이 <strong>패스키</strong>로만 잠겨 있습니다.
            </p>
            <Link href="/private" className="btn btn-primary">비공개 영역 열기 →</Link>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container">
          <p>&copy; 2026 홍주형 · 과제 8 (패스키 인증)</p>
        </div>
      </footer>
    </>
  );
}
