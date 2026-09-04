// 순수 검증 함수. 서버에서 반드시 재검사한다. 여기에 부수효과·I/O 를 두지 않는다.

export type Check = { ok: true; value: string } | { ok: false; error: string };

export function checkPasskeyLabel(raw: unknown): Check {
  if (typeof raw !== "string") return { ok: false, error: "패스키 이름이 필요합니다." };
  const value = raw.trim();
  if (value.length < 1) return { ok: false, error: "패스키 이름을 입력하세요." };
  if (value.length > 60) return { ok: false, error: "패스키 이름은 60자 이하로." };
  return { ok: true, value };
}

export function checkItemContent(raw: unknown): Check {
  if (typeof raw !== "string") return { ok: false, error: "내용이 필요합니다." };
  const value = raw.trim();
  if (value.length < 1) return { ok: false, error: "내용을 입력하세요." };
  if (value.length > 500) return { ok: false, error: "500자 이하로 입력하세요." };
  return { ok: true, value };
}

// 등록 화면이 채워 넣는 패스키 이름 기본 제안값.
export function suggestLabel(deviceType: "singleDevice" | "multiDevice", now = new Date()): string {
  const kind = deviceType === "multiDevice" ? "동기화 패스키" : "이 기기 패스키";
  const d = now.toISOString().slice(0, 10);
  return `${kind} (${d})`;
}
