import { kv, K } from "@/lib/kv";

// 등록된 패스키 = 공개키. 개인키는 인증기 안에만 있고 전송·저장되지 않는다.

export type Transport =
  | "ble"
  | "cable"
  | "hybrid"
  | "internal"
  | "nfc"
  | "smart-card"
  | "usb";

export type Credential = {
  credentialId: string; // base64url, 인증기가 만든 ID
  spaceId: string;
  publicKey: string; // base64url 로 인코딩한 COSE 공개키 바이트. 검증 전용, 비밀 아님.
  counter: number; // 서명 카운터 (복제 감지)
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  transports: Transport[];
  aaguid: string;
  label: string; // 사람이 읽는 이름 (C24/C43)
  createdAt: string; // ISO
  lastUsedAt: string | null; // ISO
};

export async function create(c: Credential): Promise<void> {
  const store = kv();
  await store.set(K.cred(c.credentialId), c);
  await store.sadd(K.spaceCreds(c.spaceId), c.credentialId);
}

export async function findById(credentialId: string): Promise<Credential | null> {
  return (await kv().get<Credential>(K.cred(credentialId))) ?? null;
}

export async function listBySpace(spaceId: string): Promise<Credential[]> {
  const store = kv();
  const ids = await store.smembers(K.spaceCreds(spaceId));
  if (ids.length === 0) return [];
  const rows = await Promise.all(ids.map((id) => store.get<Credential>(K.cred(id))));
  return rows
    .filter((r): r is Credential => r !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function countBySpace(spaceId: string): Promise<number> {
  return await kv().scard(K.spaceCreds(spaceId));
}

export async function save(c: Credential): Promise<void> {
  await kv().set(K.cred(c.credentialId), c);
}

export async function remove(credentialId: string, spaceId: string): Promise<void> {
  const store = kv();
  await store.del(K.cred(credentialId));
  await store.srem(K.spaceCreds(spaceId), credentialId);
}

export async function removeAllForSpace(spaceId: string): Promise<void> {
  const store = kv();
  const ids = await store.smembers(K.spaceCreds(spaceId));
  if (ids.length > 0) await store.del(...ids.map((id) => K.cred(id)));
  await store.del(K.spaceCreds(spaceId));
}
