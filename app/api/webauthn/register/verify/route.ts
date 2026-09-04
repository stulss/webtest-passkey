import { cookies } from "next/headers";
import { getSessionUser, createSession } from "@/lib/session";
import { registerFinish } from "@/lib/service/auth";
import { checkPasskeyLabel } from "@/lib/domain/rules";
import { storageError } from "@/lib/kv";
import { WEBAUTHN_COOKIE } from "@/lib/cookie";
import { jsonBody, badRequest, ok } from "@/lib/http";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const challengeId = jar.get(WEBAUTHN_COOKIE)?.value;
    if (!challengeId) return badRequest("등록 요청을 찾지 못했습니다. 다시 시도하세요.");

    const body = await jsonBody(request);
    const label = checkPasskeyLabel(body["label"]);
    if (!label.ok) return badRequest(label.error);
    const response = body["response"] as RegistrationResponseJSON | undefined;
    if (!response) return badRequest("등록 응답이 없습니다.");

    const sessionSpaceId = await getSessionUser();
    const result = await registerFinish({ challengeId, response, label: label.value });
    jar.delete(WEBAUTHN_COOKIE);

    if ("error" in result) return badRequest(result.error);

    // 첫 등록이면 그 자리로 로그인시킨다. 2번째 패스키면 세션 그대로.
    if (result.isNewSpace && !sessionSpaceId) {
      await createSession(result.spaceId);
      return ok({ isNewSpace: true, passkeys: result.passkeys }, 201);
    }
    return ok({ isNewSpace: false, passkeys: result.passkeys }, 201);
  } catch (e) {
    return storageError(e);
  }
}
