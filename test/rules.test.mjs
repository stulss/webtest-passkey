import test from "node:test";
import assert from "node:assert/strict";
import {
  checkPasskeyLabel,
  checkItemContent,
  suggestLabel,
} from "../lib/domain/rules.ts";

test("checkPasskeyLabel — trims and bounds", () => {
  assert.equal(checkPasskeyLabel("  내 아이폰  ").ok, true);
  assert.deepEqual(checkPasskeyLabel("  내 아이폰  "), { ok: true, value: "내 아이폰" });
  assert.equal(checkPasskeyLabel("").ok, false);
  assert.equal(checkPasskeyLabel("   ").ok, false);
  assert.equal(checkPasskeyLabel("x".repeat(61)).ok, false);
  assert.equal(checkPasskeyLabel(123).ok, false);
});

test("checkItemContent — trims and bounds", () => {
  assert.deepEqual(checkItemContent("  회고 메모 "), { ok: true, value: "회고 메모" });
  assert.equal(checkItemContent("").ok, false);
  assert.equal(checkItemContent("y".repeat(501)).ok, false);
  assert.equal(checkItemContent(null).ok, false);
});

test("suggestLabel — includes device kind and ISO date", () => {
  const s = suggestLabel("multiDevice", new Date("2026-09-04T00:00:00Z"));
  assert.match(s, /동기화 패스키/);
  assert.match(s, /2026-09-04/);
});
