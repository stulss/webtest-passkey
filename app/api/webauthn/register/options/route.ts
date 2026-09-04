import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/session";
import { registerStart } from "@/lib/service/auth";
import { storageError } from "@/lib/kv";
import { WEBAUTHN_COOKIE, CHALLENGE_SECONDS } from "@/lib/cookie";
import { ok } from "@/lib/http";

// 세션이 없으면 첫 등록(새 비공개 자리), 있으면 2번째 패스키 등록.
export async function POST() {
  try {
    const sessionSpaceId = await getSessionUser();
    const { options, challengeId } = await registerStart(sessionSpaceId);

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
