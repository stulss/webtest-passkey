import { getSessionUser } from "@/lib/session";
import { ok } from "@/lib/http";

// 로그인 여부만 알려준다. 자리 id 는 응답에 담지 않는다.
export async function GET() {
  const spaceId = await getSessionUser();
  return ok({ authenticated: spaceId !== null });
}
