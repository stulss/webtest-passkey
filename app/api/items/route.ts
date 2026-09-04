import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { list, add } from "@/lib/service/item";
import { storageError } from "@/lib/kv";
import { jsonBody, ok } from "@/lib/http";

export async function GET() {
  try {
    const spaceId = await getSessionUser();
    if (!spaceId) return unauthorized();
    // 목록은 오직 세션의 spaceId 로만 조회된다. ?user_id= 같은 쿼리는 읽지 않는다.
    return ok({ items: await list(spaceId) });
  } catch (e) {
    return storageError(e);
  }
}

export async function POST(request: Request) {
  try {
    const spaceId = await getSessionUser();
    if (!spaceId) return unauthorized();
    const body = await jsonBody(request);
    // content 만 읽는다. user_id / owner / spaceId 가 본문에 있어도 무시한다.
    const result = await add(spaceId, body["content"]);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return ok(result, 201);
  } catch (e) {
    return storageError(e);
  }
}
