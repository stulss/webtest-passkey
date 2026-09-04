import { randomUUID } from "node:crypto";
import { kv, K } from "@/lib/kv";
import { CHALLENGE_SECONDS } from "@/lib/cookie";

// 서버가 만든 challenge 를 검증 전까지 KV 에 보관한다 (C19/C27).
// 소비는 kv.getdel — 원자적 1회. 재사용/만료/취소는 전부 nil 로 귀결된다 (C31/C33).

export type Purpose = "register" | "authenticate";

export type ChallengeRow = {
  purpose: Purpose;
  challenge: string; // base64url 원문
  spaceId: string | null; // 2번째 패스키 등록/재인증용. 첫 등록·usernameless 로그인은 null.
  regUserHandle: string | null; // 첫 등록 때 verify 전 자리가 없어 보관하는 user handle 후보 (b64url)
  rpId: string;
  createdAt: string; // ISO
};

type AuditEntry = { purpose: Purpose; at: string; head: string };
const AUDIT_CAP = 200;

export async function create(row: Omit<ChallengeRow, "createdAt">): Promise<string> {
  const id = randomUUID();
  const full: ChallengeRow = { ...row, createdAt: new Date().toISOString() };
  const store = kv();
  await store.set(K.challenge(id), full, { ex: CHALLENGE_SECONDS });

  // "challenge 가 매번 다르다" 의 서버측 로그 (C20/C28). 비밀 없음: 앞 16자만.
  const audit: AuditEntry = {
    purpose: row.purpose,
    at: full.createdAt,
    head: row.challenge.slice(0, 16),
  };
  await store.lpush(K.challengeAudit, audit);
  await store.ltrim(K.challengeAudit, 0, AUDIT_CAP - 1);

  return id;
}

// 원자적 1회 소비. 목적이 다르면 소비하지 않고(되돌릴 수 없으니) null 취급한다.
export async function consume(id: string, purpose: Purpose): Promise<ChallengeRow | null> {
  const row = await kv().getdel<ChallengeRow>(K.challenge(id));
  if (!row || row.purpose !== purpose) return null;
  return row;
}

export async function peek(id: string): Promise<ChallengeRow | null> {
  return (await kv().get<ChallengeRow>(K.challenge(id))) ?? null;
}

export async function recentAudit(limit = 20): Promise<AuditEntry[]> {
  return await kv().lrange<AuditEntry>(K.challengeAudit, 0, limit - 1);
}
