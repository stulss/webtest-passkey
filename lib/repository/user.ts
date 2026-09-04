import { kv, K } from "@/lib/kv";

// "비공개 자리" = space. 회원가입 없음. 패스키를 처음 등록하면 이 레코드가 생긴다.
// 이름·이메일·비밀번호 필드는 없다.

export type Space = {
  userHandle: string; // base64url. resident key 안에 저장된 WebAuthn user handle. 화면 비노출.
  createdAt: string; // ISO
};

export async function create(spaceId: string, userHandle: string): Promise<Space> {
  const space: Space = { userHandle, createdAt: new Date().toISOString() };
  const store = kv();
  await store.set(K.space(spaceId), space);
  await store.set(K.handle(userHandle), spaceId);
  return space;
}

export async function find(spaceId: string): Promise<Space | null> {
  return (await kv().get<Space>(K.space(spaceId))) ?? null;
}

export async function findIdByHandle(userHandle: string): Promise<string | null> {
  return (await kv().get<string>(K.handle(userHandle))) ?? null;
}

export async function remove(spaceId: string): Promise<void> {
  const store = kv();
  const space = await store.get<Space>(K.space(spaceId));
  const keys = [K.space(spaceId)];
  if (space) keys.push(K.handle(space.userHandle));
  await store.del(...keys);
}
