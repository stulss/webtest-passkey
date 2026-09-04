import Link from "next/link";
import { requirePageUser } from "@/lib/session";
import * as itemSvc from "@/lib/service/item";
import * as passkeySvc from "@/lib/service/passkey";
import { ItemsPanel } from "./items";
import { PasskeysPanel } from "./passkeys";

// 익명은 middleware 가 먼저 /login 으로 보낸다. 여기서도 한 번 더 확인한다.
// 익명에게는 이 페이지의 비공개 텍스트가 SSR HTML 로 전혀 나가지 않는다.
export const dynamic = "force-dynamic";

export default async function PrivatePage() {
  const spaceId = await requirePageUser();
  const [items, passkeys] = await Promise.all([
    itemSvc.list(spaceId),
    passkeySvc.list(spaceId),
  ]);

  return (
    <div className="auth-wrap" style={{ maxWidth: 720 }}>
      <section className="panel">
        <h2>공개 영역</h2>
        <p className="hint">
          <Link href="/" className="link-btn plain">공개 소개 페이지</Link> 는 로그인 없이 누구나 봅니다.
          아래부터가 나만 보는 자리입니다.
        </p>
      </section>

      <hr className="area-divider" />
      <p>
        <span className="area-label">🔒 비공개 영역 · 나만 볼 수 있습니다</span>
      </p>

      <ItemsPanel initial={items} />
      <PasskeysPanel initial={passkeys} />
    </div>
  );
}
