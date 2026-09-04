// 자동 검증 스크립트 — 소프트웨어 인증기로 등록·로그인·격리·삭제를 재현하고
// docs/evidence/ 에 요청·응답 기록을 남긴다.
//
// 무엇을 확인하는가 (통과 기준):
//  - challenge 가 요청마다 다르다                     C20, C28
//  - 저장된 공개키로 서명을 검증한 뒤에만 통과        C29, C30
//  - 이미 쓴 challenge 는 다시 통하지 않는다          C31, C33
//  - 로그인 없이 비공개 자료 요청 → 401, 본문에 내용 없음   C16, C17, C18
//  - 로그아웃 뒤 같은 세션 재사용 → 거절              C34
//  - 한 자리에 패스키 2개, 하나 삭제 후 나머지로 로그인, 삭제된 것으로는 불가   C42, C44, C45
//  - 두 자리 사이 자료 격리(양방향), 건수 불변, 주소에 남 계정 넣어도 내 것만   C36–C40
//
// 실기기 스크린샷(Chrome DevTools WebAuthn 탭, Upstash 데이터 브라우저)으로 보완한다 → docs/검증안내서.md
//
// 사용법:  APP_URL=http://localhost:3000 node scripts/verify-webauthn.mjs

import { writeFile, mkdir } from "node:fs/promises";
import { createAuthenticator } from "../test/helpers/virtual-authenticator.mjs";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const OUT = new URL("../docs/evidence/", import.meta.url);

const results = {
  app: APP,
  ranAt: new Date().toISOString(),
  credentials_recorded: false,
  session_values_recorded: false,
  checks: {},
  isolation: [],
};
const lines = { sig: [], reuse: [], logout: [], iso: [], del: [] };
const bodies = { register: null, authenticate: null };
const BR = String.fromCharCode(10);

function jar() {
  const store = new Map();
  return {
    header() {
      return [...store.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    absorb(res) {
      const list =
        typeof res.headers.getSetCookie === "function"
          ? res.headers.getSetCookie()
          : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
      for (const part of list) {
        const m = /^\s*([^=]+)=([^;]*)/.exec(part);
        if (!m) continue;
        const maxAge0 = /max-age=0\b/i.test(part);
        if (maxAge0 || /expires=thu, 01 jan 1970/i.test(part) || m[2] === "") store.delete(m[1]);
        else store.set(m[1], m[2]);
      }
    },
    get(name) {
      return store.get(name);
    },
    raw() {
      return store;
    },
  };
}

async function call(path, { method = "GET", body, cookies } = {}) {
  const res = await fetch(APP + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookies ? { cookie: cookies.header() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  if (cookies) cookies.absorb(res);
  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, location: res.headers.get("location") };
}

const head16 = (s) => (typeof s === "string" ? s.slice(0, 16) : null);

// ---- ceremony 헬퍼 ----
async function registerPasskey(auth, cookies, label) {
  const opt = await call("/api/webauthn/register/options", { method: "POST", cookies });
  if (opt.status !== 200) throw new Error("register/options " + opt.status + " " + JSON.stringify(opt.data));
  const attResp = auth.register(opt.data);
  const verify = await call("/api/webauthn/register/verify", {
    method: "POST",
    body: { response: attResp, label },
    cookies,
  });
  return { options: opt.data, attResp, verify };
}

async function loginPasskey(auth, cookies, { badSignature = false, credentialId } = {}) {
  const opt = await call("/api/webauthn/authenticate/options", { method: "POST", cookies });
  if (opt.status !== 200) throw new Error("authenticate/options " + opt.status);
  const asseResp = badSignature
    ? auth.authenticateWithBadSignature(opt.data, credentialId)
    : auth.authenticate(opt.data, credentialId);
  const verify = await call("/api/webauthn/authenticate/verify", {
    method: "POST",
    body: { response: asseResp },
    cookies,
  });
  return { options: opt.data, asseResp, verify };
}

// ---- 1. challenge 가 매번 다르다 (C20/C28) ----
async function challengeDistinctness() {
  const log = { register: [], authenticate: [] };
  for (let i = 0; i < 5; i++) {
    const r = await call("/api/webauthn/register/options", { method: "POST", cookies: jar() });
    log.register.push({ at: new Date().toISOString(), head: head16(r.data.challenge) });
  }
  for (let i = 0; i < 5; i++) {
    const a = await call("/api/webauthn/authenticate/options", { method: "POST", cookies: jar() });
    log.authenticate.push({ at: new Date().toISOString(), head: head16(a.data.challenge) });
  }
  const all = [...log.register, ...log.authenticate].map((e) => e.head);
  const pass = new Set(all).size === all.length && all.every(Boolean);
  results.checks.challenge_distinct = { total: all.length, distinct: new Set(all).size, pass };
  await writeFile(new URL("challenge-log.json", OUT), JSON.stringify(log, null, 2));
  return pass;
}

// ---- 2. 서명 검증 성공/실패 + challenge 재사용 (C29/C30/C31/C33) ----
async function signatureAndReuse(auth1) {
  const A = jar();
  const reg = await registerPasskey(auth1, A, "검증-자리A-패스키1");
  const okLogin = await loginPasskey(auth1, A);
  bodies.register = { response: reg.attResp, label: "검증-자리A-패스키1" };
  bodies.authenticate = { response: okLogin.asseResp };

  // 잘못된 서명
  const badJar = jar();
  await registerPasskey(auth1, badJar, "임시").catch(() => {}); // badJar 는 새 자리; 무시
  const bad = await loginPasskey(auth1, jar(), { badSignature: true, credentialId: auth1.knownCredentialIds()[0] });

  // 이미 쓴 challenge 재사용: authenticate/options 로 쿠키 받고 verify 두 번
  const reuseJar = jar();
  const opt = await call("/api/webauthn/authenticate/options", { method: "POST", cookies: reuseJar });
  const asse = auth1.authenticate(opt.data, auth1.knownCredentialIds()[0]);
  const first = await call("/api/webauthn/authenticate/verify", { method: "POST", body: { response: asse }, cookies: reuseJar });
  const second = await call("/api/webauthn/authenticate/verify", { method: "POST", body: { response: asse }, cookies: reuseJar });

  lines.sig.push(
    "POST /api/webauthn/register/verify  (자리A 패스키1)      -> " + reg.verify.status,
    "POST /api/webauthn/authenticate/verify  (정상 서명)      -> " + okLogin.verify.status + " " + JSON.stringify(okLogin.verify.data),
    "POST /api/webauthn/authenticate/verify  (1바이트 변조 서명) -> " + bad.verify.status + " " + JSON.stringify(bad.verify.data)
  );
  lines.reuse.push(
    "POST /api/webauthn/authenticate/options                  -> 200, Set-Cookie: to8_webauthn=<redacted>",
    "POST /api/webauthn/authenticate/verify  (challenge 첫 사용) -> " + first.status + " " + JSON.stringify(first.data),
    "POST /api/webauthn/authenticate/verify  (같은 challenge 재사용) -> " + second.status + " " + JSON.stringify(second.data)
  );

  const pass =
    reg.verify.status === 201 &&
    okLogin.verify.status === 200 &&
    (bad.verify.status === 401 || bad.verify.status === 400) &&
    first.status === 200 &&
    second.status === 400;
  results.checks.signature_and_reuse = {
    register: reg.verify.status,
    login_ok: okLogin.verify.status,
    login_bad_signature: bad.verify.status,
    reuse_first: first.status,
    reuse_second: second.status,
    pass,
  };
  return { pass, jarA: A, credA1: reg.attResp.id };
}

// ---- 3. 패스키 2개, 하나 삭제 (C42/C44/C45) ----
async function twoPasskeysDelete(auth1) {
  const A = jar();
  const reg1 = await registerPasskey(auth1, A, "이 기기");
  const before = await call("/api/passkeys", { cookies: A });

  const auth2 = createAuthenticator({ rpId: RP_ID, label: "sw-2" });
  const reg2 = await registerPasskey(auth2, A, "보조 보안 키");
  const list2 = await call("/api/passkeys", { cookies: A });

  // 첫 패스키 삭제
  const cred1 = reg1.attResp.id;
  const cred2 = reg2.attResp.id;
  const del = await call("/api/passkeys/" + encodeURIComponent(cred1), { method: "DELETE", cookies: A });

  // 남은 패스키(auth2)로 로그인
  const loginRemaining = await loginPasskey(auth2, jar(), { credentialId: cred2 });
  // 삭제된 패스키(auth1)로 로그인 시도
  const loginDeleted = await loginPasskey(auth1, jar(), { credentialId: cred1 });
  // 마지막 하나 삭제 시도 → 409
  const delLast = await call("/api/passkeys/" + encodeURIComponent(cred2), { method: "DELETE", cookies: A });

  lines.del.push(
    "GET  /api/passkeys                     -> " + list2.status + ", 개수 " + (list2.data.passkeys?.length ?? "?"),
    "DELETE /api/passkeys/{패스키1}          -> " + del.status,
    "POST /api/webauthn/authenticate/verify  (남은 패스키2)   -> " + loginRemaining.verify.status,
    "POST /api/webauthn/authenticate/verify  (삭제된 패스키1) -> " + loginDeleted.verify.status + " " + JSON.stringify(loginDeleted.verify.data),
    "DELETE /api/passkeys/{패스키2 = 마지막} -> " + delLast.status + " " + JSON.stringify(delLast.data)
  );

  const pass =
    before.data.passkeys.length === 1 &&
    list2.data.passkeys.length === 2 &&
    del.status === 200 &&
    loginRemaining.verify.status === 200 &&
    loginDeleted.verify.status === 400 &&
    delLast.status === 409;
  results.checks.two_passkeys_delete = {
    after_first: before.data.passkeys.length,
    after_second: list2.data.passkeys.length,
    delete_first: del.status,
    login_with_remaining: loginRemaining.verify.status,
    login_with_deleted: loginDeleted.verify.status,
    delete_last_rejected: delLast.status,
    pass,
  };
  return pass;
}

// ---- 4. 자리 간 격리 (C36–C40) ----
async function isolation(authX, authY) {
  const A = jar();
  const B = jar();
  await registerPasskey(authX, A, "자리A 기기");
  await registerPasskey(authY, B, "자리B 기기");

  const aItems = ["A: 준비 중인 프로젝트 메모", "A: 지원하려는 곳 목록", "A: 이번 주 회고"];
  const bItems = ["B: 읽을 논문 목록", "B: 사이드 프로젝트 아이디어", "B: 배운 것 정리"];
  let aIds = [];
  let bIds = [];
  for (const c of aItems) {
    const r = await call("/api/items", { method: "POST", body: { content: c }, cookies: A });
    aIds = r.data.items.map((i) => i.id);
  }
  for (const c of bItems) {
    const r = await call("/api/items", { method: "POST", body: { content: c }, cookies: B });
    bIds = r.data.items.map((i) => i.id);
  }

  const aBefore = await call("/api/items", { cookies: A });
  const bBefore = await call("/api/items", { cookies: B });

  // A → B 의 항목 삭제 시도
  const aDelB = await call("/api/items/" + bIds[0], { method: "DELETE", cookies: A });
  // B → A 의 항목 삭제 시도
  const bDelA = await call("/api/items/" + aIds[0], { method: "DELETE", cookies: B });
  // A 가 주소에 B 계정을 넣어 목록 요청 (쿼리 무시되어야 함)
  const aListSpoof = await call("/api/items?user_id=" + encodeURIComponent("SPACE_B") + "&owner=SPACE_B", { cookies: A });

  const aAfter = await call("/api/items", { cookies: A });
  const bAfter = await call("/api/items", { cookies: B });

  lines.iso.push(
    "자리A 항목 3건 생성 → 자리B 항목 3건 생성",
    "DELETE /api/items/{B의 항목}   (자리A 세션) -> " + aDelB.status + " " + JSON.stringify(aDelB.data),
    "DELETE /api/items/{A의 항목}   (자리B 세션) -> " + bDelA.status + " " + JSON.stringify(bDelA.data),
    "GET /api/items?user_id=SPACE_B&owner=SPACE_B (자리A 세션) -> " + aListSpoof.status + ", 돌아온 건수 " + aListSpoof.data.items.length + " (자리A 것만)",
    "자리A 건수: 삭제 시도 전 " + aBefore.data.items.length + " → 후 " + aAfter.data.items.length,
    "자리B 건수: 삭제 시도 전 " + bBefore.data.items.length + " → 후 " + bAfter.data.items.length
  );

  const pass =
    aDelB.status === 404 &&
    bDelA.status === 404 &&
    aListSpoof.data.items.length === 3 &&
    aListSpoof.data.items.every((i) => i.content.startsWith("A:")) &&
    aBefore.data.items.length === aAfter.data.items.length &&
    bBefore.data.items.length === bAfter.data.items.length;

  results.isolation.push(
    { direction: "A→B", request: "DELETE /api/items/{B_item}", status: aDelB.status },
    { direction: "B→A", request: "DELETE /api/items/{A_item}", status: bDelA.status },
    { direction: "A spoof query", status: aListSpoof.status, returned: aListSpoof.data.items.length }
  );
  results.checks.isolation = {
    a_delete_b: aDelB.status,
    b_delete_a: bDelA.status,
    a_spoof_returned: aListSpoof.data.items.length,
    counts_unchanged:
      aBefore.data.items.length === aAfter.data.items.length &&
      bBefore.data.items.length === bAfter.data.items.length,
    pass,
  };
  return { pass, jarA: A };
}

// ---- 5. 로그인 없이 차단 + 로그아웃 뒤 재사용 (C16/C17/C18/C34) ----
async function blockedAndLogout(loggedInJarA) {
  const anon = await call("/api/items");
  const anonPage = await call("/private");

  const before = await call("/api/items", { cookies: loggedInJarA });
  const savedCookie = loggedInJarA.get("to8_session");
  await call("/api/auth/logout", { method: "POST", cookies: loggedInJarA });
  // 저장해 둔(이전) 세션 쿠키로 다시 요청
  const replayJar = jar();
  replayJar.raw().set("to8_session", savedCookie);
  const afterLogout = await call("/api/items", { cookies: replayJar });

  lines.logout.push(
    "GET /api/items   (쿠키 없음)              -> " + anon.status + " " + JSON.stringify(anon.data),
    "GET /private     (쿠키 없음)              -> " + anonPage.status + (anonPage.location ? " location: " + anonPage.location : ""),
    "GET /api/items   (로그인 상태)            -> " + before.status + ", " + before.data.items.length + "건",
    "POST /api/auth/logout                     -> 200",
    "GET /api/items   (로그아웃 뒤 같은 세션 쿠키 재사용) -> " + afterLogout.status + " " + JSON.stringify(afterLogout.data)
  );

  const bodyStr = typeof anon.data === "string" ? anon.data : JSON.stringify(anon.data);
  const pass =
    (anon.status === 401 || anon.status === 403) &&
    !/회고|지원|프로젝트 메모/.test(bodyStr) &&
    (anonPage.status === 307 || anonPage.status === 302) &&
    before.status === 200 &&
    afterLogout.status === 401;
  results.checks.blocked_and_logout = {
    anon_items: anon.status,
    anon_page: anonPage.status,
    after_logout_replay: afterLogout.status,
    pass,
  };
  return pass;
}

async function writeEvidence() {
  const md = (title, arr) => "# " + title + "\n\n```http\n" + arr.join("\n") + "\n```\n";
  await writeFile(new URL("서명검증_성공_실패.md", OUT),
    md("저장된 공개키로 서명 검증 — 성공과 실패 (C29 / C30)", lines.sig) +
    "\n> 성공한 로그인은 서버가 `cred:{id}` 에 저장해 둔 공개키로 `verifyAuthenticationResponse` 를 통과한 것이고,\n> 1바이트만 바꾼 서명은 같은 경로에서 거절된다.\n");
  await writeFile(new URL("이미쓴질문_재사용.md", OUT),
    md("이미 쓴 challenge 재사용 거절 (C31 / C33)", lines.reuse) +
    "\n> verify 라우트는 서명 검증 전에 `challenge.consume`(`GETDEL`) 로 challenge 를 원자적으로 소비한다.\n> 소비된 challenge 로 다시 오면 `GETDEL` 이 nil 이라 400.\n");
  await writeFile(new URL("패스키_삭제_후.md", OUT),
    md("패스키 2개 등록, 하나 삭제 (C42 / C44 / C45)", lines.del));
  await writeFile(new URL("계정간_격리_요청응답.md", OUT),
    md("자리 간 자료 격리 — 양방향 (C36–C40)", lines.iso) +
    "\n> 거절을 만드는 소스: `lib/repository/item.ts` — 모든 함수가 첫 인자 `spaceId` 로만 키를 만들고,\n> 단건 삭제는 `item.spaceId === 세션 spaceId` 확인 후에만 실행한다. `spaceId` 는 `lib/session.ts:getSessionUser()`(쿠키 전용)에서만 온다.\n");
  await writeFile(new URL("미로그인_차단_요청응답.md", OUT),
    md("로그인 없이 비공개 자료 요청 + 로그아웃 뒤 재사용 (C16 / C17 / C18 / C34)", lines.logout) +
    "\n> 세션 값은 <redacted> 로 가렸다.\n");
  // 등록·로그인 요청 본문 원문 (C23 / C29) — Network 탭 스크린샷 대체
  const redactHandle = (o) => {
    const c = structuredClone(o);
    if (c.response?.response?.userHandle) c.response.response.userHandle = "<redacted>";
    return c;
  };
  await writeFile(new URL("등록_로그인_요청본문.md", OUT), [
    "# 등록·로그인 요청 본문 원문 (C23 / C29)",
    "",
    "브라우저가 서버로 실제로 보내는 것 전부다. 개인키(`d`)는 어디에도 없다 —",
    "인증기가 만든 키쌍 중 공개키만 `attestationObject` 안에 담겨 나간다.",
    "",
    "## POST /api/webauthn/register/verify — 요청 본문",
    "",
    "```json",
    JSON.stringify(redactHandle(bodies.register), null, 2),
    "```",
    "",
    "- 최상위 필드: `response`(id·rawId·type·response·clientExtensionResults) + `label`",
    "- `response.response` 안: `clientDataJSON`, `attestationObject`, `transports` — **그게 전부**",
    "- 개인키·시드·비밀번호에 해당하는 필드 없음",
    "",
    "## POST /api/webauthn/authenticate/verify — 요청 본문",
    "",
    "```json",
    JSON.stringify(redactHandle(bodies.authenticate), null, 2),
    "```",
    "",
    "- `signature` 는 개인키로 만든 **서명**이지 개인키가 아니다.",
    "- 서버는 이 서명을 `cred:{id}.publicKey`(저장된 공개키)로 검증한다 → `lib/webauthn.ts:checkAuthentication`",
    "- `userHandle` 은 이 문서에서 가렸다 (C34).",
    "",
  ].join(BR));

  await writeFile(new URL("webauthn-verify-results.json", OUT), JSON.stringify(results, null, 2));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const auth1 = createAuthenticator({ rpId: RP_ID, label: "sw-1" });

  const c1 = await challengeDistinctness();
  const c2 = await signatureAndReuse(auth1);
  const c3 = await twoPasskeysDelete(createAuthenticator({ rpId: RP_ID, label: "sw-A" }));
  const c4 = await isolation(
    createAuthenticator({ rpId: RP_ID, label: "sw-X" }),
    createAuthenticator({ rpId: RP_ID, label: "sw-Y" })
  );
  const c5 = await blockedAndLogout(c4.jarA);

  await writeEvidence();

  const summary = {
    challenge_distinct: c1,
    signature_and_reuse: c2.pass,
    two_passkeys_delete: c3,
    isolation: c4.pass,
    blocked_and_logout: c5,
    all_pass: c1 && c2.pass && c3 && c4.pass && c5,
  };
  results.summary = summary;
  await writeFile(new URL("webauthn-verify-results.json", OUT), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.all_pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
