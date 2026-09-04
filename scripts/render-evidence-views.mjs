// 실제 DB 내용과 실제 HTTP 요청·응답을 표로 렌더링해 스크린샷으로 남긴다.
//
// 벤더 콘솔(Redis Cloud)이나 Postman 화면이 아니다 — 이 스크립트가 직접 조회·요청한 결과이며
// 화면 상단에 그 출처를 적어 둔다. 내용은 동일하고 언제든 재현 가능하다.
//
// 사용법: node --env-file=.env.local scripts/render-evidence-views.mjs

import puppeteer from "puppeteer-core";
import Redis from "ioredis";
import { decodeCredentialPublicKey } from "@simplewebauthn/server/helpers";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";

const APP = process.env.APP_URL ?? "https://webtest-passkey.vercel.app";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = new URL("../docs/evidence/", import.meta.url).pathname.replace(/^\//, "");

const esc = (s) =>
  String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);

const CSS = [
  "body{margin:0;background:#0b0d10;color:#e8eaee;font:14px/1.65 'Malgun Gothic',system-ui,sans-serif;padding:28px 32px}",
  "h1{font-size:20px;margin:0 0 4px}",
  ".src{color:#8b93a0;font-size:12px;margin:0 0 20px;border-left:3px solid #7fc8a9;padding-left:10px}",
  "h2{font-size:15px;margin:24px 0 8px;color:#9fe3c3}",
  "table{border-collapse:collapse;width:100%;font:12.5px/1.6 Consolas,monospace}",
  "th,td{border:1px solid #262b33;padding:7px 10px;text-align:left;vertical-align:top}",
  "th{background:#14171c;color:#a7adba;font-weight:600}",
  "td.k{color:#9fe3c3;white-space:nowrap}",
  ".ok{color:#7fc8a9;font-weight:700}.no{color:#e0736f;font-weight:700}",
  "pre{margin:0;font:12.5px/1.6 Consolas,monospace;white-space:pre-wrap;word-break:break-all}",
  ".note{margin-top:8px;color:#a7adba;font-size:12.5px}",
  ".badge{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;border:1px solid #3a4150;color:#a7adba;margin-left:6px}",
].join("");

async function shot(page, html, file) {
  await page.setViewport({ width: 1180, height: 900 });
  await page.setContent('<meta charset="utf-8"><style>' + CSS + "</style>" + html, { waitUntil: "load" });
  await page.screenshot({ path: join(OUT, file), fullPage: true });
  console.log("  [shot] " + file);
}

async function dbView(page) {
  const r = new Redis(process.env.REDIS_URL);
  const keys = (await r.keys("*")).sort();
  const rows = [];
  for (const k of keys) {
    const ttl = await r.ttl(k);
    const t = await r.type(k);
    let v = "";
    if (t === "string") v = (await r.get(k)) ?? "";
    else if (t === "set") v = "SET " + JSON.stringify(await r.smembers(k));
    else if (t === "list") v = "LIST(" + (await r.llen(k)) + ") " + JSON.stringify(await r.lrange(k, 0, 1));
    rows.push({ k, t, ttl, v: v.length > 140 ? v.slice(0, 140) + "\u2026" : v });
  }

  const credKey = keys.find((k) => k.startsWith("cred:"));
  let detail = '<p class="no">등록된 패스키가 없습니다.</p>';
  if (credKey) {
    const c = JSON.parse(await r.get(credKey));
    const cose = decodeCredentialPublicKey(new Uint8Array(Buffer.from(c.publicKey, "base64url")));
    const g = (n) => cose.get(n);
    const hex = (n) => Buffer.from(g(n)).toString("hex").slice(0, 40);
    detail =
      "<pre>" + esc(JSON.stringify(c, null, 2)) + "</pre>" +
      "<h2>위 publicKey 를 COSE 로 풀면</h2>" +
      "<table><tr><th>필드</th><th>값</th><th>뜻</th></tr>" +
      '<tr><td class="k">kty (1)</td><td>' + g(1) + "</td><td>2 = EC2 — 타원곡선 <b>공개키</b></td></tr>" +
      '<tr><td class="k">alg (3)</td><td>' + g(3) + "</td><td>-7 = ES256</td></tr>" +
      '<tr><td class="k">crv (-1)</td><td>' + g(-1) + "</td><td>1 = P-256</td></tr>" +
      '<tr><td class="k">x (-2)</td><td>' + hex(-2) + "\u2026</td><td>곡선 위 좌표 (32바이트)</td></tr>" +
      '<tr><td class="k">y (-3)</td><td>' + hex(-3) + "\u2026</td><td>곡선 위 좌표 (32바이트)</td></tr>" +
      '<tr><td class="k">d</td><td class="no">없음</td><td>개인키. 인증기 밖으로 나오지 않아 서버에 없다</td></tr>' +
      "</table>";
  }

  const pw = keys.filter((k) => /pass|pwd|secret|hash/i.test(k));
  const html =
    '<h1>서버(Redis)에 실제로 저장된 것 <span class="badge">C19 · C21 · C22</span></h1>' +
    '<p class="src">출처: <code>scripts/render-evidence-views.mjs</code> 가 프로덕션 Redis(<code>REDIS_URL</code>)에 ' +
    "직접 조회한 결과. Redis Cloud 콘솔 화면이 아니라 스크립트 조회 결과이며, " +
    "<code>scripts/show-stored-credential.mjs</code> 로 같은 값을 다시 볼 수 있다.</p>" +
    "<h2>키 전체 (" + rows.length + "개)</h2>" +
    "<table><tr><th>키</th><th>형</th><th>TTL(초)</th><th>값</th></tr>" +
    rows.map((x) =>
      '<tr><td class="k">' + esc(x.k) + "</td><td>" + x.t + "</td><td>" +
      (x.ttl < 0 ? "-" : x.ttl) + "</td><td><pre>" + esc(x.v) + "</pre></td></tr>").join("") +
    "</table>" +
    '<p class="note">비밀번호·해시로 보이는 키: <span class="' + (pw.length ? "no" : "ok") + '">' +
    pw.length + "개</span>" +
    (pw.length ? " (" + pw.join(", ") + ")" : " — 없음. 이 앱에는 비밀번호가 존재하지 않는다.") + "</p>" +
    "<h2>등록된 패스키 레코드 (<code>" + esc(credKey ?? "-") + "</code>)</h2>" + detail;

  r.disconnect();
  await shot(page, html, "T08-A05-DB저장내용.png");
}

async function httpView(page) {
  const calls = [];
  const add = async (label, path, note) => {
    const res = await fetch(APP + path, { redirect: "manual" });
    const body = (await res.text()).slice(0, 180);
    calls.push({ label, path, status: res.status, body, note, loc: res.headers.get("location") });
  };
  await add("로그인 없이 비공개 자료 조회", "/api/items", "C16 · C17 — 401 로 거절");
  await add("로그인 없이 비공개 화면", "/private", "C15 — 로그인 화면으로 보냄");

  const opt = async (p) => (await (await fetch(APP + p, { method: "POST" })).json()).challenge;
  const c1 = await opt("/api/webauthn/register/options");
  const c2 = await opt("/api/webauthn/register/options");
  const a1res = await fetch(APP + "/api/webauthn/authenticate/options", { method: "POST" });
  const ck = /to8_webauthn=([^;]+)/.exec(a1res.headers.getSetCookie().join(";"))[1];
  const a1c = (await a1res.json()).challenge;

  const bogus = {
    id: "none", rawId: "none", type: "public-key",
    response: { clientDataJSON: "e30", authenticatorData: "e30", signature: "e30", userHandle: null },
    clientExtensionResults: {},
  };
  const post = () =>
    fetch(APP + "/api/webauthn/authenticate/verify", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "to8_webauthn=" + ck },
      body: JSON.stringify({ response: bogus }),
    });
  const v1 = await post(); const v1b = await v1.text();
  const v2 = await post(); const v2b = await v2.text();
  const distinct = new Set([c1, c2, a1c]).size === 3;

  const html =
    '<h1>실제 요청과 응답 <span class="badge">C16 · C17 · C19 · C20 · C27 · C28 · C31 · C33</span></h1>' +
    '<p class="src">출처: <code>scripts/render-evidence-views.mjs</code> 가 <code>' + APP + "</code> 에 직접 보낸 요청. " +
    "Postman 화면이 아니라 스크립트가 보낸 실제 요청·응답이며, 세션 값은 남기지 않았다(C34).</p>" +
    "<h2>거절되는 요청</h2>" +
    "<table><tr><th>무엇</th><th>요청 (쿠키 없음)</th><th>응답</th><th>기준</th></tr>" +
    calls.map((c) =>
      "<tr><td>" + esc(c.label) + '</td><td class="k">GET ' + esc(c.path) +
      '</td><td><b class="no">HTTP ' + c.status + "</b><pre>" +
      esc(c.loc ? "location: " + c.loc : c.body) + "</pre></td><td>" + esc(c.note) + "</td></tr>").join("") +
    "</table>" +
    "<h2>질문(challenge)은 매번 다르다</h2>" +
    "<table><tr><th>요청</th><th>돌아온 challenge (앞 24자)</th></tr>" +
    '<tr><td class="k">POST /api/webauthn/register/options (1회차)</td><td>' + esc(c1.slice(0, 24)) + "\u2026</td></tr>" +
    '<tr><td class="k">POST /api/webauthn/register/options (2회차)</td><td>' + esc(c2.slice(0, 24)) + "\u2026</td></tr>" +
    '<tr><td class="k">POST /api/webauthn/authenticate/options</td><td>' + esc(a1c.slice(0, 24)) + "\u2026</td></tr>" +
    "</table>" +
    '<p class="note">세 값이 서로 <span class="' + (distinct ? "ok" : "no") + '">' +
    (distinct ? "모두 다름" : "겹침") + "</span> — C20 · C28</p>" +
    '<h2>이미 쓴 질문은 다시 통하지 않는다 <span class="badge">C31 · C33</span></h2>' +
    "<table><tr><th>요청</th><th>응답</th></tr>" +
    '<tr><td class="k">POST /api/webauthn/authenticate/verify<br>(challenge 첫 사용)</td>' +
    '<td><b class="no">HTTP ' + v1.status + "</b><pre>" + esc(v1b) + "</pre></td></tr>" +
    '<tr><td class="k">POST /api/webauthn/authenticate/verify<br>(<b>같은 challenge 재사용</b>)</td>' +
    '<td><b class="no">HTTP ' + v2.status + "</b><pre>" + esc(v2b) + "</pre></td></tr>" +
    "</table>" +
    '<p class="note">첫 요청에서 서명 검증에 실패하더라도 challenge 는 <code>GETDEL</code> 로 이미 소비된다. ' +
    "그래서 재사용 요청은 \u201c인증 요청이 만료되었거나 이미 처리되었습니다\u201d 로 거절된다.</p>";

  await shot(page, html, "T08-A06-요청응답기록.png");
}

const profile = join(tmpdir(), "to8-render-" + Date.now());
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", userDataDir: profile });
const page = await browser.newPage();
try {
  await dbView(page);
  await httpView(page);
} finally {
  await browser.close();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
