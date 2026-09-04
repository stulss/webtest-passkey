import { kv, K } from "@/lib/kv";
import { SESSION_SECONDS } from "@/lib/cookie";

// 세션 저장소. 쿠키에는 불투명 난수 원문이, KV 에는 그 sha256 해시만 있다.

export async function create(tokenHash: string, spaceId: string): Promise<void> {
  const store = kv();
  await store.set(K.session(tokenHash), spaceId, { ex: SESSION_SECONDS });
  await store.sadd(K.spaceSessions(spaceId), tokenHash);
}

export async function findSpace(tokenHash: string): Promise<string | null> {
  const spaceId = await kv().get<string>(K.session(tokenHash));
  return spaceId ?? null;
}

export async function removeOne(tokenHash: string): Promise<void> {
  const store = kv();
  const spaceId = await store.get<string>(K.session(tokenHash));
  await store.del(K.session(tokenHash));
  if (spaceId) await store.srem(K.spaceSessions(spaceId), tokenHash);
}

export async function removeAllForSpace(spaceId: string): Promise<void> {
  const store = kv();
  const hashes = await store.smembers(K.spaceSessions(spaceId));
  if (hashes.length > 0) {
    await store.del(...hashes.map((h) => K.session(h)));
  }
  await store.del(K.spaceSessions(spaceId));
}
