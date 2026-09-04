// 서버(Redis)에 실제로 저장된 값을 그대로 꺼내 보여준다 — C21 / C22 증거용.
//
// 보여주는 것:
//  - 저장된 패스키 레코드 전체 (publicKey 는 base64url 원문)
//  - 그 publicKey 를 COSE 로 풀어 kty/alg/crv/x/y 를 표시 → "이건 EC P-256 공개키다"
//  - 저장소에 있는 키 종류 전부 → 비밀번호/해시 키가 없다는 것
//  - 살아 있는 challenge (있으면) → 서버가 확인할 때까지 보관한다는 것 (C19)
//
// 사용법:
//   vercel env pull .env.local
//   node --env-file=.env.local scripts/show-stored-credential.mjs
//
// 주의: 출력에 세션 값·접속 문자열은 찍지 않는다. 공개키는 비밀이 아니므로 그대로 보여도 된다.

import Redis from "ioredis";
import { decodeCredentialPublicKey } from "@simplewebauthn/server/helpers";

const url = process.env.REDIS_URL ?? process.env.KV_URL;
if (!url) {
  console.error("REDIS_URL 이 없습니다. `vercel env pull .env.local` 후 --env-file=.env.local 로 실행하세요.");
  process.exit(1);
}

const r = new Redis(url);
const line = (s = "") => console.log(s);

const keys = await r.keys("*");
const kinds = {};
for (const k of keys) kinds[k.split(":")[0]] = (kinds[k.split(":")[0]] ?? 0) + 1;

line("=== 저장소에 있는 키 종류 ===");
line(Object.entries(kinds).map(([k, n]) => `  ${k}:*  ${n}개`).join("\n") || "  (비어 있음 — 먼저 패스키를 등록하세요)");
line();
const passwordish = keys.filter((k) => /pass|pwd|secret|hash/i.test(k));
line(`비밀번호/해시로 보이는 키: ${passwordish.length}개 ${passwordish.length ? passwordish.join(", ") : "— 없음"}`);
line();

const credKeys = keys.filter((k) => k.startsWith("cred:"));
if (credKeys.length === 0) {
  line("등록된 패스키가 없습니다. https://webtest-passkey.vercel.app/login 에서 먼저 등록하세요.");
  r.disconnect();
  process.exit(0);
}

for (const key of credKeys) {
  const cred = JSON.parse(await r.get(key));
  line("=== " + key + " (서버에 저장된 값 전체) ===");
  line(JSON.stringify(cred, null, 2));
  line();

  const cose = decodeCredentialPublicKey(new Uint8Array(Buffer.from(cred.publicKey, "base64url")));
  const g = (n) => cose.get(n);
  line("  위 publicKey 를 COSE 로 풀면:");
  line(`    kty(1)  = ${g(1)}   (2 = EC2, 타원곡선 공개키)`);
  line(`    alg(3)  = ${g(3)}   (-7 = ES256)`);
  line(`    crv(-1) = ${g(-1)}  (1 = P-256)`);
  line(`    x(-2)   = ${Buffer.from(g(-2)).toString("hex").slice(0, 32)}… (32바이트)`);
  line(`    y(-3)   = ${Buffer.from(g(-3)).toString("hex").slice(0, 32)}… (32바이트)`);
  line("    → 곡선 위의 좌표 (x, y). 검증에만 쓰는 공개키이고 비밀번호가 아니다.");
  line("    → 개인키 d 는 이 레코드에 없다. 인증기 밖으로 나오지 않기 때문이다.");
  line(`    레코드에 d 필드 존재? ${Object.keys(cred).includes("d") ? "있음(문제!)" : "없음"}`);
  line();
}

const chKeys = keys.filter((k) => k.startsWith("challenge:") && k !== "challenge:audit");
line(`=== 살아 있는 challenge: ${chKeys.length}개 (서버가 확인할 때까지 보관, TTL 5분) ===`);
for (const k of chKeys) {
  const ttl = await r.ttl(k);
  const row = JSON.parse(await r.get(k));
  line(`  ${k}  purpose=${row.purpose}  남은 TTL=${ttl}s  challenge 앞 16자=${row.challenge.slice(0, 16)}…`);
}

r.disconnect();
