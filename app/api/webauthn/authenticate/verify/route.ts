import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { authenticateFinish } from "@/lib/service/auth";
import { storageError } from "@/lib/kv";
import { WEBAUTHN_COOKIE } from "@/lib/cookie";
import { jsonBody, badRequest, ok } from "@/lib/http";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const challengeId = jar.get(WEBAUTHN_COOKIE)?.value;
    if (!challengeId) return badRequest("로그인 요청을 찾지 못했습니다. 다시 시도하세요.");

    const body = await jsonBody(request);
    const response = body["response"] as AuthenticationResponseJSON | undefined;
    if (!response) return badRequest("로그인 응답이 없습니다.");

    const result = await authenticateFinish({ challengeId, response });
    jar.delete(WEBAUTHN_COOKIE);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    await createSession(result.spaceId);
    return ok({ ok: true });
  } catch (e) {
    return storageError(e);
  }
}
