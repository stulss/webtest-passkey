import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

// 라우트 소스를 정적으로 훑어 규약이 지켜지는지 확인한다.
// (동작 검증은 scripts/verify-webauthn.mjs 가 실행 중인 서버로 한다.)

const API = new URL("../app/api/", import.meta.url);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name === "route.ts") out.push(p);
  }
  return out;
}

const routeFiles = await walk(API);
const read = async (u) => readFile(u, "utf8");

// 인증이 필요 없는 공개 라우트
const PUBLIC = [
  "webauthn/register/options",
  "webauthn/register/verify",
  "webauthn/authenticate/options",
  "webauthn/authenticate/verify",
  "auth/logout",
  "auth/me",
];
const isPublic = (u) => PUBLIC.some((p) => u.href.includes("/api/" + p + "/"));

test("보호 라우트는 getSessionUser + unauthorized 가드를 가진다", async () => {
  for (const u of routeFiles) {
    if (isPublic(u)) continue;
    const src = await read(u);
    assert.match(src, /getSessionUser\(\)/, `${u.href} 에 getSessionUser 없음`);
    assert.match(src, /unauthorized\(\)/, `${u.href} 에 unauthorized 가드 없음`);
  }
});

test("어떤 라우트도 요청에서 spaceId/user_id 를 읽지 않는다", async () => {
  for (const u of routeFiles) {
    const src = await read(u);
    assert.doesNotMatch(src, /searchParams\.get\(["'](user_id|owner|spaceId|space_id)["']\)/, `${u.href}`);
    assert.doesNotMatch(src, /body\[["'](user_id|owner|spaceId|space_id)["']\]/, `${u.href}`);
  }
});

test("비밀번호 입력·해시 코드가 어디에도 없다", async () => {
  const files = [
    ...routeFiles,
    new URL("../app/login/page.tsx", import.meta.url),
    new URL("../lib/service/auth.ts", import.meta.url),
  ];
  for (const u of files) {
    const src = await read(u);
    assert.doesNotMatch(src, /type=["']password["']/i, `${u.href} 에 비밀번호 입력칸`);
    assert.doesNotMatch(src, /bcrypt|scrypt|argon2|pbkdf2/i, `${u.href} 에 비밀번호 해시`);
  }
});

test("items 단건 삭제는 spaceId + itemId 두 인자를 넘긴다", async () => {
  const src = await read(new URL("items/[id]/route.ts", API));
  assert.match(src, /remove\(spaceId,\s*id\)/);
});
