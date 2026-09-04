import { NextResponse } from "next/server";

// 요청 본문에서 지정한 키만 뽑는다. 그 외 키(user_id, owner, spaceId 등)는 절대 읽지 않는다.
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const raw = await request.json();
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function str(body: Record<string, unknown>, key: string): string | null {
  const v = body[key];
  return typeof v === "string" ? v : null;
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
