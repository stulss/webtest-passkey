import type { Credential } from "@/lib/repository/credential";
import type { Item } from "@/lib/repository/item";

// KV 원본 객체를 그대로 반환하지 않는다. 화이트리스트만 내보낸다.
// spaceId, publicKey, counter, aaguid, userHandle 등 내부 값은 응답에 없다.

export type PublicPasskey = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  storedAt: string; // 사람이 읽는 저장 위치 문구
};

export function publicPasskey(c: Credential): PublicPasskey {
  return {
    id: c.credentialId,
    label: c.label,
    createdAt: c.createdAt,
    lastUsedAt: c.lastUsedAt,
    storedAt: deviceSentence(c),
  };
}

export type PublicItem = {
  id: string;
  content: string;
  createdAt: string;
};

export function publicItem(i: Item): PublicItem {
  return { id: i.id, content: i.content, createdAt: i.createdAt };
}

// "이 패스키가 어디에 저장됐는지" 사람이 읽는 문구 (C26). AAGUID→이름 매핑은 없고 flags/transports 휴리스틱.
export function deviceSentence(c: Pick<Credential, "deviceType" | "backedUp" | "transports">): string {
  const t = c.transports ?? [];
  if (t.includes("usb") || t.includes("nfc") || t.includes("smart-card")) {
    return "보안 키(USB/NFC) 에 저장됨";
  }
  if (c.deviceType === "multiDevice" && c.backedUp) {
    return "동기화되는 패스키 (예: Google 비밀번호 관리자 · iCloud 키체인)";
  }
  if (t.includes("internal")) {
    return "이 기기에 저장됨 (동기화 안 됨)";
  }
  if (t.includes("hybrid") || t.includes("cable")) {
    return "다른 기기의 패스키를 QR/근접으로 사용";
  }
  return "저장 위치를 특정하지 못함";
}
