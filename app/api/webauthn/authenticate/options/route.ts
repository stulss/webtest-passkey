import { cookies } from "next/headers";
import { authenticateStart } from "@/lib/service/auth";
import { storageError } from "@/lib/kv";
import { WEBAUTHN_COOKIE, CHALLENGE_SECONDS } from "@/lib/cookie";
import { ok } from "@/lib/http";

export async function POST() {
  try {
    const { options, challengeId } = await authenticateStart();
    (await cookies()).set(WEBAUTHN_COOKIE, challengeId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CHALLENGE_SECONDS,
    });
    return ok(options);
  } catch (e) {
    return storageError(e);
  }
}
