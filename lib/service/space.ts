import * as users from "@/lib/repository/user";
import * as credentials from "@/lib/repository/credential";
import * as items from "@/lib/repository/item";
import * as sessions from "@/lib/repository/session";

// 비공개 자리와 그에 딸린 모든 것을 지운다. 패스키가 하나도 남지 않는 상태를 만드는 유일한 경로.
export async function destroy(spaceId: string): Promise<void> {
  await items.removeAllForSpace(spaceId);
  await credentials.removeAllForSpace(spaceId);
  await sessions.removeAllForSpace(spaceId);
  await users.remove(spaceId);
}
