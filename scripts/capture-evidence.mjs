// 증거 스크린샷 자동 촬영.
// Chrome 을 CDP 로 몰고, DevTools 의 WebAuthn 가상 인증기를 CDP(WebAuthn 도메인)로 켜서
// 등록 → 항목 추가 → 두 번째 패스키 → 삭제 → 남은 패스키로 로그인 까지 실제 화면을 찍는다.
//
// 실기기 프롬프트(T08-E03)만은 사람이 폰에서 찍어야 한다. 가상 인증기는 프롬프트를 띄우지 않는다.
//
// 사용법:  APP_URL=https://webtest-passkey.vercel.app node scripts/capture-evidence.mjs

import puppeteer from "puppeteer-core";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP = process.env.APP_URL ?? "https://webtest-passkey.vercel.app";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = new URL("../docs/evidence/", import.meta.url).pathname.replace(/^\//, "");
const profile = join(tmpdir(), "to8-capture-" + Date.now());

const shot = async (page, name) => {
  await page.screenshot({ path: join(OUT, name), fullPage: false });
  console.log("  📸 " + name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BR2 = String.fromCharCode(10);

// 화면의 버튼/링크를 글자로 찾아 누른다
async function clickText(page, text) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button, a")].find((e) => e.textContent.trim().includes(t));
    if (!el) return false;
    el.click();
    return true;
  }, text);
  if (!ok) throw new Error(`"${text}" 를 찾지 못했습니다`);
  await sleep(1200);
}

const waitKeys = (page, n) =>
  page.waitForFunction((c) => document.querySelectorAll(".passkey-list li").length === c, { timeout: 20000 }, n);

async function addAuthenticator(client, transport = "internal") {
  const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return authenticatorId;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    userDataDir: profile,
    args: ["--window-size=1280,900"],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  const client = await page.createCDPSession();
  await client.send("WebAuthn.enable");

  try {
    // ── ① 공개 소개 (세션 없음 = 시크릿과 동일) ───────────────────────────
    console.log("① 공개 소개");
    await page.goto(APP + "/", { waitUntil: "networkidle2" });
    await shot(page, "T08-E01-public-incognito.png");
    // "지어낸 내용" 고지가 보이는 위치까지 스크롤해서 한 장 더
    await page.evaluate(() => document.querySelector(".notice")?.scrollIntoView({ block: "center" }));
    await sleep(500);
    await shot(page, "T08-E01-public-incognito-b.png");

    // ── ② 잠김 확인 + 페이지 소스에 비공개 내용 없음 ──────────────────────
    console.log("② /private 잠김");
    await page.goto(APP + "/private", { waitUntil: "networkidle2" });
    const landedOn = page.url();
    await shot(page, "T08-E02-private-redirect.png");
    const html = await page.content();
    const anonItems = await page.evaluate(async (app) => {
      const r = await fetch(app + "/api/items");
      return { status: r.status, body: await r.text() };
    }, APP);
    await writeFile(join(OUT, "T08-E02-미로그인_페이지소스_확인.txt"), [
      "# 로그인하지 않은 상태에서 받은 것 (C15 / C16 / C17 / C18)",
      "",
      `GET ${APP}/private  →  최종 도착지: ${landedOn}`,
      `GET ${APP}/api/items (쿠키 없음)  →  HTTP ${anonItems.status}  ${anonItems.body}`,
      "",
      "받은 페이지 소스에서 비공개 항목 텍스트 검색:",
      ...["회고", "지원", "프로젝트 메모", "비공개 항목"].map(
        (w) => `  "${w}" 포함? ${html.includes(w) ? "있음" : "없음"}`
      ),
      "",
      `페이지 소스 길이: ${html.length}자 (로그인 화면)`,
    ].join("\n"));
    console.log("  📄 T08-E02-미로그인_페이지소스_확인.txt");

    // ── 가상 인증기 #1 로 등록 ────────────────────────────────────────────
    console.log("③ 패스키 등록 (가상 인증기 #1)");
    const auth1 = await addAuthenticator(client);
    await page.goto(APP + "/login", { waitUntil: "networkidle2" });
    await page.evaluate(() => {
      const i = document.querySelector("#pk-label");
      if (i) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(i, "이 PC (가상 인증기)");
        i.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await shot(page, "T08-E03b-login-screen.png");
    await clickText(page, "패스키로 비공개 자리 만들기");
    await page.waitForFunction(() => location.pathname === "/private", { timeout: 15000 });
    await sleep(800);

    // ── ⑤ 비공개 항목 3건 ────────────────────────────────────────────────
    console.log("④ 비공개 항목 3건 추가");
    // UI 폼 대신 같은 세션으로 API 호출 후 새로고침 — 결과 화면은 동일하다
    await page.evaluate(async () => {
      for (const content of [
        "준비 중: 공조냉동 필기 오답노트 정리",
        "지원 목록: 설비관리 3곳, IT 헬프데스크 1곳",
        "이번 주 회고: 패스키의 도메인 바인딩(rpID)을 처음 이해함",
      ]) {
        await fetch("/api/items", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content }),
        });
      }
    });
    await page.reload({ waitUntil: "networkidle2" });
    await sleep(600);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, "T08-E05-private-items.png");
    const aItemId = await page.evaluate(async () => (await (await fetch("/api/items")).json()).items[0].id);

    // ── ⑥ 두 번째 패스키 (가상 인증기 #2) ────────────────────────────────
    console.log("⑤ 두 번째 패스키 등록 (가상 인증기 #2)");
    // Chrome 은 internal 인증기를 환경당 하나만 허용한다 → 두 번째는 보안 키(usb)로
    const auth2 = await addAuthenticator(client, "usb");
    await clickText(page, "다른 패스키 등록");
    await waitKeys(page, 2);
    await sleep(600);
    await page.evaluate(() => document.querySelector(".passkey-list")?.scrollIntoView({ block: "center" }));
    await sleep(400);
    await shot(page, "T08-E04-passkey-list.png");

    // ── ⑦ 첫 패스키 삭제 → 남은 것으로 로그인 ────────────────────────────
    console.log("⑥ 첫 패스키 삭제 → 남은 패스키로 로그인");
    const firstLabel = await page.evaluate(() => {
      const li = document.querySelector(".passkey-list li");
      const btn = [...li.querySelectorAll("button")].find((b) => b.textContent.trim() === "삭제");
      const label = li.querySelector("strong").textContent;
      btn.click();
      return label;
    });
    await waitKeys(page, 1);
    await sleep(600);
    await page.evaluate(() => document.querySelector(".passkey-list")?.scrollIntoView({ block: "center" }));
    await shot(page, "T08-A01a-패스키_삭제직후.png");
    console.log("  삭제한 패스키: " + firstLabel);

    // 삭제한 패스키의 인증기를 제거해서 "그 기기를 잃은" 상태로 만든다
    await client.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId: auth1 });
    await clickText(page, "로그아웃");
    await page.waitForFunction(() => location.pathname === "/login", { timeout: 15000 });
    await sleep(600);
    await clickText(page, "패스키로 로그인");
    await page.waitForFunction(() => location.pathname === "/private", { timeout: 15000 });
    await sleep(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, "T08-A01b-남은패스키로_로그인성공.png");

    // ── ⑧ 마지막 패스키 삭제 시도 → 409 ──────────────────────────────────
    console.log("⑦ 마지막 패스키 삭제 시도 → 거절");
    await page.evaluate(() => {
      const li = document.querySelector(".passkey-list li");
      [...li.querySelectorAll("button")].find((b) => b.textContent.trim() === "삭제").click();
    });
    // danger-zone 에 같은 문구가 정적으로 있으므로 에러 요소(.msg.err)를 직접 기다린다
    await page.waitForFunction(
      () => document.querySelector(".msg.err")?.textContent.includes("마지막 패스키"),
      { timeout: 20000 }
    );
    await sleep(400);
    await page.evaluate(() =>
      document.querySelector(".msg.err")?.scrollIntoView({ block: "center" })
    );
    await shot(page, "T08-A01c-마지막패스키_삭제거절.png");

    // ── 삭제된(등록 안 된) 패스키로 로그인 시도 → 실패 (C45) ────────────
    console.log("8) 등록 안 된 패스키로 로그인 시도 -> 실패");
    {
      const ctx2 = await browser.createBrowserContext();   // 쿠키 격리
      const p2 = await ctx2.newPage();
      const c2 = await p2.createCDPSession();
      await c2.send("WebAuthn.enable");
      await c2.send("WebAuthn.addVirtualAuthenticator", {
        options: { protocol: "ctap2", transport: "nfc", hasResidentKey: true,
                   hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
      });
      await p2.goto(APP + "/login", { waitUntil: "networkidle2" });
      await p2.evaluate(() => {
        [...document.querySelectorAll("button")]
          .find((e) => e.textContent.includes("패스키로 로그인")).click();
      });
      await p2.waitForFunction(() => document.querySelector(".msg"), { timeout: 30000 }).catch(() => {});
      await sleep(800);
      await p2.screenshot({ path: join(OUT, "T08-C45-등록안된패스키_로그인실패.png") });
      console.log("  [shot] T08-C45-등록안된패스키_로그인실패.png");
      await p2.close();
      await ctx2.close();
    }

    // ── 로그인 없이 비공개 자료 직접 요청 → 401 (C16 / C17) ──────────────
    console.log("9) 미로그인 API 직접 요청 -> 401");
    {
      const ctx3 = await browser.createBrowserContext();   // 세션 없는 상태를 보장
      const p3 = await ctx3.newPage();
      const resp = await p3.goto(APP + "/api/items", { waitUntil: "networkidle2" });
      await p3.evaluate((st) => {
        const bar = document.createElement("div");
        bar.style.cssText =
          "font:15px/1.7 monospace;padding:14px 16px;margin:28px 0 8px;background:#2b1416;color:#ffb3ae;border:1px solid #5a2b2b;border-radius:6px";
        bar.textContent = "GET /api/items  (쿠키 없음)  →  HTTP " + st;
        document.body.prepend(bar);
      }, resp.status());
      await sleep(300);
      await p3.screenshot({ path: join(OUT, "T08-C16-미로그인_API_401.png") });
      console.log("  [shot] T08-C16-미로그인_API_401.png (HTTP " + resp.status() + ")");
      if (resp.status() !== 401) throw new Error("미로그인 요청이 401 이 아님: " + resp.status());
      await p3.close();
      await ctx3.close();
    }

    // ── 두 번째 자리: 내용이 다르고 서로 안 보인다 (C36 / C37 / C40) ─────
    console.log("10) 두 번째 비공개 자리 - 다른 내용, 서로 안 보임");
    {
      const ctx4 = await browser.createBrowserContext();   // 진짜 다른 자리가 되도록 쿠키 분리
      const p4 = await ctx4.newPage();
      const c4 = await p4.createCDPSession();
      await c4.send("WebAuthn.enable");
      await c4.send("WebAuthn.addVirtualAuthenticator", {
        options: { protocol: "ctap2", transport: "usb", hasResidentKey: true,
                   hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
      });
      await p4.goto(APP + "/login", { waitUntil: "networkidle2" });
      await p4.evaluate(() => {
        const i = document.querySelector("#pk-label");
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(i, "두 번째 자리의 기기");
        i.dispatchEvent(new Event("input", { bubbles: true }));
        [...document.querySelectorAll("button")]
          .find((e) => e.textContent.includes("패스키로 비공개 자리 만들기")).click();
      });
      await p4.waitForFunction(() => location.pathname === "/private", { timeout: 30000 });
      await p4.evaluate(async () => {
        for (const content of [
          "B: 읽을 논문 목록 — WebAuthn L3 hints",
          "B: 사이드 프로젝트 아이디어 3개",
          "B: 이번 달 배운 것 정리",
        ]) {
          await fetch("/api/items", { method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content }) });
        }
      });
      await p4.reload({ waitUntil: "networkidle2" });
      await sleep(700);
      await p4.evaluate(() => window.scrollTo(0, 0));
      await p4.screenshot({ path: join(OUT, "T08-C36-두번째자리_다른내용.png") });
      console.log("  [shot] T08-C36-두번째자리_다른내용.png");

      const cross = await p4.evaluate(async (otherId) => {
        const del = await fetch("/api/items/" + otherId, { method: "DELETE" });
        const body = await del.text();
        const mine = await (await fetch("/api/items?user_id=OTHER&owner=OTHER")).json();
        return { status: del.status, body, count: mine.items.length,
                 contents: mine.items.map((i) => i.content) };
      }, aItemId);
      await writeFile(join(OUT, "T08-C37-자리간_접근시도.txt"), [
        "# 다른 자리의 항목에 접근 시도 (C37 / C38 / C39 / C40)",
        "",
        "자리 B 세션으로 자리 A 의 항목 id 를 지정해 삭제 시도:",
        "  DELETE /api/items/" + aItemId + "   ->  HTTP " + cross.status + "  " + cross.body,
        "",
        "같은 세션으로 주소에 남의 계정을 적어 목록 요청:",
        "  GET /api/items?user_id=OTHER&owner=OTHER   ->  " + cross.count + "건 (자리 B 의 것만)",
        ...cross.contents.map((c) => "    - " + c),
        "",
        "-> 거절을 만드는 소스: lib/repository/item.ts (첫 인자 spaceId, 소유자 확인 후에만 삭제).",
        "   spaceId 는 lib/session.ts:getSessionUser() (쿠키 전용) 에서만 온다.",
      ].join(BR2));
      console.log("  [txt] T08-C37-자리간_접근시도.txt (DELETE->" + cross.status + ", 목록 " + cross.count + "건)");
      if (cross.status !== 404 || cross.count !== 3)
        throw new Error("격리 확인 실패: DELETE=" + cross.status + ", 목록=" + cross.count + "건");

      p4.on("dialog", (d) => d.accept());
      await p4.evaluate(() => {
        [...document.querySelectorAll("button")]
          .find((e) => e.textContent.includes("비공개 자리와 모든 항목 삭제")).click();
      });
      await p4.waitForFunction(() => location.pathname === "/login", { timeout: 20000 }).catch(() => {});
      await p4.close();
      await ctx4.close();
    }

    // ── 촬영용 자리 정리 (반복 실행해도 안 쌓이게) ────────────────────────
    console.log("11) 촬영용 자리 정리");
    page.on("dialog", (d) => d.accept());
    await page.evaluate(() => {
      [...document.querySelectorAll("button")]
        .find((e) => e.textContent.includes("비공개 자리와 모든 항목 삭제")).click();
    });
    await page.waitForFunction(() => location.pathname === "/login", { timeout: 20000 }).catch(() => {});
    console.log("  [clean] 촬영용 비공개 자리 삭제됨");

    console.log("\n완료. docs/evidence/ 확인하세요.");
    console.log("남은 것: T08-E03 (실기기 등록 프롬프트) — 폰에서 직접 촬영");
  } finally {
    await browser.close();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
