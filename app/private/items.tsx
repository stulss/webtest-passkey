"use client";

import { useState } from "react";

type Item = { id: string; content: string; createdAt: string };

export function ItemsPanel({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState<Item[]>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error ?? "추가하지 못했습니다.");
      return;
    }
    setItems(data.items);
    setDraft("");
  }

  async function remove(id: string) {
    setErr(null);
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error ?? "삭제하지 못했습니다.");
      return;
    }
    setItems(data.items);
  }

  return (
    <section className="panel">
      <h2>비공개 항목</h2>
      <p className="hint">
        준비 중인 프로젝트 메모, 지원하려는 곳, 스스로 쓰는 회고처럼 나만 보는 항목입니다.
        (실제 개인정보는 넣지 마세요 — 만들어 넣은 내용으로 충분합니다.)
      </p>

      <form onSubmit={add} className="row" style={{ marginBottom: 16 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="새 항목 입력 (최대 500자)"
          maxLength={500}
          style={{ flex: 1, minWidth: 220, padding: "10px 12px" }}
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "추가 중…" : "항목 추가"}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="hint">아직 항목이 없습니다. 위에서 세 개 이상 추가해 보세요.</p>
      ) : (
        <ul className="item-list">
          {items.map((it) => (
            <li key={it.id}>
              <span>{it.content}</span>
              <button type="button" className="link-btn" onClick={() => remove(it.id)}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      {err && <p className="msg err">{err}</p>}
    </section>
  );
}
