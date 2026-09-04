import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import * as sessions from "@/lib/repository/session";
import { SESSION_COOKIE, SESSION_SECONDS } from "@/lib/cookie";

// 쿠키 값은 의미 없는 난수다. 서명하지 않으므로 서명키가 없다.
// KV 에 이 값의 SHA-256 해시가 남아 있어야만 유효하다.
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(spaceId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await sessions.create(hashToken(token), spaceId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

// 자리(spaceId)를 알아내는 유일한 경로. 주소·헤더·요청 본문에서 읽는 코드는 이 프로젝트에 없다.
export async function getSessionUser(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return await sessions.findSpace(hashToken(token));
}

// 로그아웃은 KV 키를 지우는 것이다. 브라우저에 값이 남아 있어도 다시 통하지 않는다.
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sessions.removeOne(hashToken(token));
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(spaceId: string): Promise<void> {
  await sessions.removeAllForSpace(spaceId);
  (await cookies()).delete(SESSION_COOKIE);
}

// 화면용. 로그인하지 않았으면 자료 대신 로그인 화면으로 보낸다.
export async function requirePageUser(): Promise<string> {
  const spaceId = await getSessionUser();
  if (!spaceId) redirect("/login");
  return spaceId;
}

// API 용. 라우트는 이 응답을 그대로 돌려준다.
export function unauthorized() {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

export function notFound(message = "찾지 못했습니다.") {
  return NextResponse.json({ error: message }, { status: 404 });
}
