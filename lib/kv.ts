import Redis from "ioredis";
import { memoryKV } from "@/lib/kv-memory";

// 저장소 어댑터. Vercel Marketplace 의 Redis 통합이 주는 REDIS_URL(TCP)로 붙는다.
// 서버 코드에서만 import 한다. 접속 문자열은 서버 전용이며 브라우저로 전달하지 않는다.
//
// 값은 JSON 으로 넣고 뺀다(객체·문자열 모두). SET 계열 멤버만 평문 id 그대로 쓴다.
// 로컬에 REDIS_URL 이 없고 프로덕션이 아니면 인메모리 KV 로 폴백한다.

export type KvLike = {
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  get<T = unknown>(key: string): Promise<T | null>;
  getdel<T = unknown>(key: string): Promise<T | null>;
  del(...keys: string[]): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  scard(key: string): Promise<number>;
  lpush(key: string, value: unknown): Promise<number>;
  rpush(key: string, value: unknown): Promise<number>;
  lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]>;
  lrem(key: string, count: number, value: unknown): Promise<number>;
  llen(key: string): Promise<number>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
};

const enc = (v: unknown) => JSON.stringify(v);
const dec = <T>(s: string | null): T | null => {
  if (s === null) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return s as unknown as T; // 예전에 평문으로 들어간 값 방어
  }
};

function wrap(r: Redis): KvLike {
  return {
    set: (k, v, o) => (o?.ex ? r.set(k, enc(v), "EX", o.ex) : r.set(k, enc(v))),
    get: async <T>(k: string) => dec<T>(await r.get(k)),
    getdel: async <T>(k: string) => dec<T>(await r.getdel(k)),
    del: (...keys) => r.del(...keys),
    sadd: (k, ...m) => r.sadd(k, ...m),
    srem: (k, ...m) => r.srem(k, ...m),
    smembers: (k) => r.smembers(k),
    scard: (k) => r.scard(k),
    lpush: (k, v) => r.lpush(k, enc(v)),
    rpush: (k, v) => r.rpush(k, enc(v)),
    lrange: async <T>(k: string, s: number, e: number) =>
      (await r.lrange(k, s, e)).map((x) => dec<T>(x)!) as T[],
    lrem: (k, c, v) => r.lrem(k, c, enc(v)),
    llen: (k) => r.llen(k),
    ltrim: (k, s, e) => r.ltrim(k, s, e),
  };
}

// 서버리스에서 호출마다 새 연결을 열지 않도록 프로세스 전역에 하나만 둔다.
const g = globalThis as unknown as { __to8_kv__?: KvLike };

export function kv(): KvLike {
  if (g.__to8_kv__) return g.__to8_kv__;

  const url = process.env.REDIS_URL ?? process.env.KV_URL;
  if (url) {
    g.__to8_kv__ = wrap(
      new Redis(url, { maxRetriesPerRequest: 3, enableReadyCheck: false, lazyConnect: false })
    );
    return g.__to8_kv__;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[kv] REDIS_URL 이 없어 인메모리 KV 로 실행합니다 (로컬 전용, 재시작 시 초기화).");
    g.__to8_kv__ = memoryKV() as unknown as KvLike;
    return g.__to8_kv__;
  }

  throw new Error("REDIS_URL 이 없습니다. Vercel Storage 의 Redis 통합을 연결하세요.");
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
