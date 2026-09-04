import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/cookie";

// Next.js 16 의 proxy(구 middleware). 1차 관문일 뿐이다 — 세션 쿠키가 있는지만 본다.
// 실제 차단은 각 라우트의 getSessionUser 와 repository 의 spaceId 조건이 한다.
const PUBLIC_PREFIXES = [
  "/login",
  "/api/webauthn/register",
  "/api/webauthn/authenticate",
  "/api/auth/me",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)) return NextResponse.next();

  // API 는 리다이렉트가 아니라 거절 응답.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
