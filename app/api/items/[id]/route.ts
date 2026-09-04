import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { remove } from "@/lib/service/item";
import { storageError } from "@/lib/kv";
import { ok } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// 소유자 확인 후에만 지운다. 남의 항목이면 404 (존재를 숨긴다). 거절해도 상대 자료는 그대로다.
export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const spaceId = await getSessionUser();
    if (!spaceId) return unauthorized();
    const { id } = await ctx.params;
    const result = await remove(spaceId, id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return ok(result);
  } catch (e) {
    return storageError(e);
  }
}
