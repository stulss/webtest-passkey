import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { rename, remove } from "@/lib/service/passkey";
import { storageError } from "@/lib/kv";
import { jsonBody, ok } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// credentialId 는 base64url 이라 URL 인코딩되어 온다.
const credId = (raw: string) => decodeURIComponent(raw);

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const spaceId = await getSessionUser();
    if (!spaceId) return unauthorized();
    const { id } = await ctx.params;
    const body = await jsonBody(request);
    const result = await rename(spaceId, credId(id), body["label"]);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return ok(result);
  } catch (e) {
    return storageError(e);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const spaceId = await getSessionUser();
    if (!spaceId) return unauthorized();
    const { id } = await ctx.params;
    const result = await remove(spaceId, credId(id));
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return ok(result);
  } catch (e) {
    return storageError(e);
  }
}
