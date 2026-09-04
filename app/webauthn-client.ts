"use client";

import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

export class CancelledError extends Error {
  constructor() {
    super("사용자가 취소했습니다.");
    this.name = "CancelledError";
  }
}

function isCancel(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e.name === "NotAllowedError" || e.name === "AbortError")
  );
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// 등록: 세션이 없으면 새 비공개 자리 생성, 있으면 현재 자리에 2번째 패스키 추가.
// 서버가 세션 유무로 분기하므로 클라이언트 코드는 동일하다.
export async function registerPasskey(label: string): Promise<{ isNewSpace: boolean; passkeys: unknown[] }> {
  const opt = await post("/api/webauthn/register/options");
  if (!opt.res.ok) throw new Error(opt.data.error ?? "등록을 시작하지 못했습니다.");

  let attResp;
  try {
    attResp = await startRegistration({ optionsJSON: opt.data });
  } catch (e) {
    if (isCancel(e)) throw new CancelledError();
    throw new Error("이 브라우저·기기에서 패스키를 만들 수 없습니다.");
  }

  const verify = await post("/api/webauthn/register/verify", { response: attResp, label });
  if (!verify.res.ok) throw new Error(verify.data.error ?? "등록을 확인하지 못했습니다.");
  return verify.data;
}

// usernameless 로그인.
export async function loginWithPasskey(): Promise<void> {
  const opt = await post("/api/webauthn/authenticate/options");
  if (!opt.res.ok) throw new Error(opt.data.error ?? "로그인을 시작하지 못했습니다.");

  let asseResp;
  try {
    asseResp = await startAuthentication({ optionsJSON: opt.data });
  } catch (e) {
    if (isCancel(e)) throw new CancelledError();
    throw new Error("패스키 선택 창을 열 수 없습니다.");
  }

  const verify = await post("/api/webauthn/authenticate/verify", { response: asseResp });
  if (!verify.res.ok) throw new Error(verify.data.error ?? "로그인하지 못했습니다.");
}

export async function logout(): Promise<void> {
  await post("/api/auth/logout");
}
