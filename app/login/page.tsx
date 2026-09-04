"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { registerPasskey, loginWithPasskey, CancelledError } from "../webauthn-client";

function todayLabel() {
  return `내 기기 (${new Date().toISOString().slice(0, 10)})`;
}

export default function LoginPage() {
  const [label, setLabel] = useState(todayLabel());
  const [busy, setBusy] = useState<null | "login" | "register">(null);
  const [msg, setMsg] = useState<{ kind: "err" | "info" | "okmsg"; text: string } | null>(null);
  // 이 기기에 지문·PIN 같은 내장 인증기가 있는지. 없으면 Windows/브라우저가 USB 보안 키만 제시한다.
  const [hasPlatform, setHasPlatform] = useState<boolean | null>(null);

  useEffect(() => {
    PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.()
      .then(setHasPlatform)
      .catch(() => setHasPlatform(null));
  }, []);

  async function onLogin() {
    setBusy("login");
    setMsg(null);
    try {
      await loginWithPasskey();
      // 쿠키를 fetch 응답으로 방금 받았다. 클라이언트 라우터로 넘기면
      // 라우터 캐시가 이전 상태를 들고 있어 proxy 에서 다시 튕긴다. 전체 로드로 간다.
      window.location.replace("/private");
    } catch (e) {
      if (e instanceof CancelledError) {
        setMsg({ kind: "info", text: "로그인을 취소했습니다." });
      } else {
        setMsg({ kind: "err", text: e instanceof Error ? e.message : "로그인하지 못했습니다." });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onRegister() {
    setBusy("register");
    setMsg(null);
    try {
      await registerPasskey(label.trim() || todayLabel());
      // 쿠키를 fetch 응답으로 방금 받았다. 클라이언트 라우터로 넘기면
      // 라우터 캐시가 이전 상태를 들고 있어 proxy 에서 다시 튕긴다. 전체 로드로 간다.
      window.location.replace("/private");
    } catch (e) {
      if (e instanceof CancelledError) {
        setMsg({ kind: "info", text: "등록을 취소했습니다. 저장된 것은 없습니다." });
      } else {
        setMsg({ kind: "err", text: e instanceof Error ? e.message : "등록하지 못했습니다." });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>비공개 영역</h1>
        <p>
          비밀번호는 없습니다. <strong>패스키</strong>로만 들어갑니다. 이미 이 기기(또는 동기화된
          비밀번호 관리자)에 패스키가 있으면 로그인하고, 없으면 새로 만드세요.
        </p>

        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "100%" }}
          onClick={onLogin}
          disabled={busy !== null}
        >
          {busy === "login" ? "패스키 확인 중…" : "패스키로 로그인"}
        </button>

        <hr className="area-divider" />

        <div className="field">
          <label htmlFor="pk-label">새로 만들 패스키 이름 (비밀번호 아님)</label>
          <input
            id="pk-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          className="btn"
          style={{ width: "100%" }}
          onClick={onRegister}
          disabled={busy !== null}
        >
          {busy === "register" ? "등록을 기다리는 중…" : "패스키로 비공개 자리 만들기"}
        </button>

        {msg && <p className={`msg ${msg.kind}`}>{msg.text}</p>}

        {hasPlatform === false && (
          <p className="msg info">
            이 기기에는 지문·얼굴·PIN 같은 <strong>내장 인증기</strong>가 없습니다. 대신
            비밀번호 관리자(Google 등)나 휴대폰·보안 키로 저장할 수 있습니다. 이 기기 자체에
            저장하려면 Windows 설정 → 계정 → 로그인 옵션에서 PIN(Windows Hello)을 먼저 만드세요.
          </p>
        )}

        <p className="msg info" style={{ marginTop: 24 }}>
          <Link href="/" className="link-btn plain">← 공개 소개로 돌아가기</Link>
        </p>
      </div>
    </div>
  );
}
