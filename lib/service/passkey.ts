import * as credentials from "@/lib/repository/credential";
import { publicPasskey, type PublicPasskey } from "@/lib/dto/records";
import { checkPasskeyLabel } from "@/lib/domain/rules";

export async function list(spaceId: string): Promise<PublicPasskey[]> {
  return (await credentials.listBySpace(spaceId)).map(publicPasskey);
}

export async function rename(
  spaceId: string,
  credentialId: string,
  rawLabel: unknown
): Promise<{ passkeys: PublicPasskey[] } | { error: string; status: number }> {
  const check = checkPasskeyLabel(rawLabel);
  if (!check.ok) return { error: check.error, status: 400 };

  const cred = await credentials.findById(credentialId);
  if (!cred || cred.spaceId !== spaceId) return { error: "찾지 못했습니다.", status: 404 };

  await credentials.save({ ...cred, label: check.value });
  return { passkeys: await list(spaceId) };
}

export async function remove(
  spaceId: string,
  credentialId: string
): Promise<{ passkeys: PublicPasskey[] } | { error: string; status: number }> {
  const cred = await credentials.findById(credentialId);
  if (!cred || cred.spaceId !== spaceId) return { error: "찾지 못했습니다.", status: 404 };

  const count = await credentials.countBySpace(spaceId);
  if (count <= 1) {
    return {
      error:
        "마지막 패스키는 삭제할 수 없습니다. 자리를 지우려면 '비공개 자리 삭제'를 사용하세요.",
      status: 409,
    };
  }

  await credentials.remove(credentialId, spaceId);
  return { passkeys: await list(spaceId) };
}
