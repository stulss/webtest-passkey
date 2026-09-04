import { destroySession } from "@/lib/session";
import { storageError } from "@/lib/kv";
import { ok } from "@/lib/http";

export async function POST() {
  try {
    await destroySession();
    return ok({ ok: true });
  } catch (e) {
    return storageError(e);
  }
}
