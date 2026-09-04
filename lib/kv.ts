import { Redis } from "@upstash/redis";
import { memoryKV } from "@/lib/kv-memory";

// Vercel Marketplace 의 Upstash Redis 통합이 주입하는 REST 자격증명으로 만든 단일 클라이언트.
// 서버 코드에서만 import 한다. 토큰은 서버 전용이며 브라우저로 전달하지 않는다.
//
// 로컬에서 자격증명이 없고 프로덕션이 아니면 인메모리 KV 로 폴백한다 (흐름 눈으로 확인용).
type KvLike = Pick<
  Redis,
  | "set" | "get" | "getdel" | "del"
  | "sadd" | "srem" | "smembers" | "scard"
  | "lpush" | "rpush" | "lrange" | "lrem" | "llen" | "ltrim"
>;

let client: KvLike | undefined;

export function kv(): KvLike {
  if (client) return client;

  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    client = new Redis({ url, token }) as unknown as KvLike;
    return client;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[kv] Upstash 자격증명이 없어 인메모리 KV 로 실행합니다 (로컬 전용, 재시작 시 초기화)."
    );
    client = memoryKV() as unknown as KvLike;
    return client;
  }

  throw new Error(
    "KV_REST_API_URL / KV_REST_API_TOKEN (또는 UPSTASH_REDIS_REST_*) 이 없습니다. `vercel env pull .env.local` 로 받으세요."
  );
}

// 키 이름은 한 곳에서만 만든다. 자리 격리는 이 접두사 규칙에 달려 있다.
export const K = {
  space: (spaceId: string) => `space:${spaceId}`,
  spaceCreds: (spaceId: string) => `space:${spaceId}:creds`,
  spaceItems: (spaceId: string) => `space:${spaceId}:items`,
  spaceSessions: (spaceId: string) => `space:${spaceId}:sessions`,
  handle: (userHandleB64: string) => `handle:${userHandleB64}`,
  cred: (credentialId: string) => `cred:${credentialId}`,
  challenge: (id: string) => `challenge:${id}`,
  challengeAudit: "challenge:audit",
  item: (itemId: string) => `item:${itemId}`,
  session: (tokenHash: string) => `session:${tokenHash}`,
} as const;

export function storageError(error: unknown): Response {
  console.error(error);
  return Response.json({ error: "저장하지 못했습니다 — 다시 시도" }, { status: 500 });
}
