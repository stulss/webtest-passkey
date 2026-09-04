"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerPasskey, logout, CancelledError } from "../webauthn-client";

type Passkey = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  storedAt: string;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" });

function credPath(id: string) {
  return `/api/passkeys/${encodeURIComponent(id)}`;
}

export function PasskeysPanel({ initial }: { initial: Passkey[] }) {
  const router = useRouter();
  const [keys, setKeys] = useState<Passkey[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "info" | "okmsg"; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  async function addAnother() {
    setBusy(true);
    setMsg({ kind: "info", text: "등록을 기다리는 중… 브라우저 프롬프트에서 취소하면 아무것도 저장되지 않습니다." });
    try {
      const suggested = `추가 기기 (${new Date().toISOString().slice(0, 10)})`;
      const result = await registerPasskey(suggested);
      setKeys(result.passkeys as Passkey[]);
      setMsg({ kind: "okmsg", text: "패스키를 추가했습니다." });
    } catch (e) {
      if (e instanceof CancelledError) {
        setMsg({ kind: "info", text: "등록을 취소했습니다. 저장된 패스키에는 변화가 없습니다." });
      } else {
        setMsg({ kind: "err", text: e instanceof Error ? e.message : "등록하지 못했습니다." });
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveLabel(id: string) {
    const res = await fetch(credPath(id), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: editLabel }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ kind: "err", text: data.error ?? "이름을 바꾸지 못했습니다." });
      return;
    }
    setKeys(data.passkeys);
    setEditing(null);
  }

  async function removeKey(id: string) {
    setMsg(null);
    const res = await fetch(credPath(id), { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ kind: "err", text: data.error ?? "삭제하지 못했습니다." });
      return;
    }
    setKeys(data.passkeys);
    setMsg({ kind: "okmsg", text: "패스키를 삭제했습니다. 남은 패스키로 계속 로그인할 수 있습니다." });
  }

  async function onLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  async function onDeleteSpace() {
    if (!confirm("이 비공개 자리와 모든 항목·패스키를 영구히 삭제합니다. 되돌릴 수 없습니다. 진행할까요?")) return;
    const res = await fetch("/api/space", { method: "DELETE" });
    if (res.ok) {
      router.replace("/login");
      router.refresh();
    } else {
      setMsg({ kind: "err", text: "삭제하지 못했습니다." });
    }
  }

  return (
    <>
      <section className="panel">
        <h2>등록된 패스키</h2>
        <p className="hint">
          서버에는 각 패스키의 <strong>공개키</strong>만 저장됩니다. 개인키는 기기(또는 비밀번호
          관리자) 밖으로 나가지 않습니다. 기기를 잃을 때를 대비해 두 개 이상 등록해 두세요.
        </p>

        <ul className="passkey-list">
          {keys.map((k) => (
            <li key={k.id}>
              <div>
                {editing === k.id ? (
                  <span className="row">
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      maxLength={60}
                      style={{ padding: "6px 8px" }}
                    />
                    <button className="link-btn plain" onClick={() => saveLabel(k.id)}>저장</button>
                    <button className="link-btn" onClick={() => setEditing(null)}>취소</button>
                  </span>
                ) : (
                  <>
                    <strong>{k.label}</strong>{" "}
                    <button
                      className="link-btn plain"
                      onClick={() => {
                        setEditing(k.id);
                        setEditLabel(k.label);
                      }}
                    >
                      이름 변경
                    </button>
                  </>
                )}
                <div className="passkey-meta">
                  등록: {fmt(k.createdAt)}
                  {k.lastUsedAt ? ` · 마지막 사용: ${fmt(k.lastUsedAt)}` : " · 아직 사용 안 함"}
                  <br />
                  {k.storedAt}
                </div>
              </div>
              <button type="button" className="link-btn" onClick={() => removeKey(k.id)}>삭제</button>
            </li>
          ))}
        </ul>

        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={addAnother} disabled={busy}>
            다른 패스키 등록
          </button>
          <button type="button" className="btn" onClick={onLogout}>로그아웃</button>
        </div>
        {msg && <p className={`msg ${msg.kind}`}>{msg.text}</p>}
      </section>

      <section className="panel danger-zone">
        <h2>비공개 자리 삭제</h2>
        <p className="hint">
          마지막 패스키는 삭제할 수 없습니다(계정 잠김 방지). 완전히 정리하려면 아래 버튼으로
          자리 전체를 지웁니다 — 항목·패스키·세션이 모두 사라지고 로그인할 수 없게 됩니다.
        </p>
        <button type="button" className="btn btn-danger" onClick={onDeleteSpace}>
          비공개 자리와 모든 항목 삭제
        </button>
      </section>
    </>
  );
}
