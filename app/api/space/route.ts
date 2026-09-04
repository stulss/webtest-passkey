import { cookies } from "next/headers";
import { getSessionUser, unauthorized } from "@/lib/session";
import { destroy } from "@/lib/service/space";
import { storageError } from "@/lib/kv";
import { SESSION_COOKIE } from "@/lib/cookie";
import { ok } from "@/lib/http";

// 비공개 자리 삭제. 마지막 패스키까지 지우는 대신 이걸 쓴다.
export async function DELETE() {
  try {
    const spaceId = await getSessionUser();
    if (!spaceId) return unauthorized();
    await destroy(spaceId);
    (await cookies()).delete(SESSION_COOKIE);
    return ok({ ok: true });
  } catch (e) {
    return storageError(e);
  }
}
