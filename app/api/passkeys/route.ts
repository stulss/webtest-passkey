import { getSessionUser, unauthorized } from "@/lib/session";
import { list } from "@/lib/service/passkey";
import { storageError } from "@/lib/kv";
import { ok } from "@/lib/http";

export async function GET() {
  try {
    const spaceId = await getSessionUser();
    if (!spaceId) return unauthorized();
    return ok({ passkeys: await list(spaceId) });
  } catch (e) {
    return storageError(e);
  }
}
