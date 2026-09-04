import { randomUUID } from "node:crypto";
import { kv, K } from "@/lib/kv";

// ★ 자리 간 격리의 급소.
// 모든 함수가 첫 인자로 spaceId 를 받고, 키를 항상 space:{spaceId}:items / item:{id}(소유자 확인 후)
// 로만 만든다. spaceId 는 lib/session.ts:getSessionUser() (쿠키 전용) 에서만 온다.
// 다른 자리의 키에 접근하는 코드 경로는 존재하지 않는다.

export type Item = {
  id: string;
  spaceId: string;
  content: string; // ≤ 500자
  createdAt: string; // ISO
};

export async function list(spaceId: string): Promise<Item[]> {
  const store = kv();
  const ids = await store.lrange<string>(K.spaceItems(spaceId), 0, -1);
  if (ids.length === 0) return [];
  const rows = await Promise.all(ids.map((id) => store.get<Item>(K.item(id))));
  // 방어: 혹시라도 소유자가 어긋난 행은 내보내지 않는다.
  return rows.filter((r): r is Item => r !== null && r.spaceId === spaceId);
}

export async function count(spaceId: string): Promise<number> {
  return await kv().llen(K.spaceItems(spaceId));
}

export async function add(spaceId: string, content: string): Promise<Item> {
  const item: Item = {
    id: randomUUID(),
    spaceId,
    content,
    createdAt: new Date().toISOString(),
  };
  const store = kv();
  await store.set(K.item(item.id), item);
  await store.rpush(K.spaceItems(spaceId), item.id);
  return item;
}

// 소유자 확인 후에만 지운다. 남의 항목이면 아무것도 하지 않고 false.
export async function remove(spaceId: string, itemId: string): Promise<boolean> {
  const store = kv();
  const item = await store.get<Item>(K.item(itemId));
  if (!item || item.spaceId !== spaceId) return false;
  await store.lrem(K.spaceItems(spaceId), 0, itemId);
  await store.del(K.item(itemId));
  return true;
}

export async function removeAllForSpace(spaceId: string): Promise<void> {
  const store = kv();
  const ids = await store.lrange<string>(K.spaceItems(spaceId), 0, -1);
  if (ids.length > 0) await store.del(...ids.map((id) => K.item(id)));
  await store.del(K.spaceItems(spaceId));
}
