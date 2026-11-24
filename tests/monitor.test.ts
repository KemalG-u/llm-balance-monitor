// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  classify,
  parseEnvText,
  trimHistory,
  checkDeepSeek,
  checkMoonshot,
  checkOpenRouter,
  type FetchLike,
} from "../lib.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const reply =
  (status: number, body: unknown): FetchLike =>
  async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

test("classify thresholds", () => {
  assert.equal(classify("deepseek", 0.5)?.level, "critical");
  assert.equal(classify("deepseek", 2)?.level, "warning");
  assert.equal(classify("deepseek", 10)?.level, "ok");
  assert.equal(classify("openrouter", -1)?.level, "ok");
  assert.equal(classify("unknown", 1), null);
  assert.equal(classify("deepseek", undefined), null);
});

test("parseEnvText handles quotes, comments, CRLF", () => {
  const e = parseEnvText('A=1\r\n# c\nB="two"\n  C = \'3\' \nbad line\n');
  assert.deepEqual(e, { A: "1", B: "two", C: "3" });
});

test("trimHistory keeps newest entries", () => {
  assert.deepEqual(trimHistory([1, 2, 3, 4], 2), [3, 4]);
  assert.deepEqual(trimHistory([1], 2), [1]);
});

test("missing keys report an error without any network call", async () => {
  let called = false;
  const f: FetchLike = async () => {
    called = true;
    throw new Error("must not be called");
  };
  assert.match((await checkDeepSeek({}, f)).error!, /not set/);
  assert.match((await checkMoonshot({}, f)).error!, /not set/);
  assert.match((await checkOpenRouter({}, f)).error!, /not set/);
  assert.equal(called, false);
});

test("DeepSeek parses USD balance", async () => {
  const r = await checkDeepSeek(
    { DEEPSEEK_API_KEY: "test" },
    reply(200, { is_available: true, balance_infos: [{ currency: "USD", total_balance: "4.25" }] }),
  );
  assert.equal(r.balance, 4.25);
  assert.equal(r.currency, "USD");
});

test("Moonshot parses balance; china base url means CNY", async () => {
  const body = { data: { available_balance: "7.5" } };
  const a = await checkMoonshot({ MOONSHOT_API_KEY: "test" }, reply(200, body));
  assert.equal(a.currency, "USD");
  assert.equal(a.balance, 7.5);
  const b = await checkMoonshot(
    { MOONSHOT_API_KEY: "test", MOONSHOT_BASE_URL: "https://api.moonshot.cn" },
    reply(200, body),
  );
  assert.equal(b.currency, "CNY");
});

test("OpenRouter: limit minus usage, or -1 when unlimited", async () => {
  const a = await checkOpenRouter({ OPENROUTER_API_KEY: "test" }, reply(200, { data: { usage: 2, limit: 10 } }));
  assert.equal(a.balance, 8);
  const b = await checkOpenRouter({ OPENROUTER_API_KEY: "test" }, reply(200, { data: { usage: 2, limit: null } }));
  assert.equal(b.balance, -1);
});

test("HTTP errors and exceptions become error results", async () => {
  const r = await checkOpenRouter({ OPENROUTER_API_KEY: "test" }, reply(401, {}));
  assert.equal(r.error, "HTTP 401");
  const boom: FetchLike = async () => {
    throw new Error("network down");
  };
  assert.equal((await checkDeepSeek({ DEEPSEEK_API_KEY: "test" }, boom)).error, "network down");
});

test("TLS verification is never disabled in source", () => {
  const files = readdirSync(root).filter((n) => /\.(ts|cmd|ps1|js|py)$/.test(n));
  assert.ok(files.length > 0);
  for (const f of files) {
    const text = readFileSync(join(root, f), "utf8");
    assert.ok(!/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/.test(text), `${f} disables TLS verification`);
    assert.ok(!/rejectUnauthorized\s*:\s*false/.test(text), `${f} disables TLS verification`);
    assert.ok(!/verify\s*=\s*False/.test(text), `${f} disables TLS verification`);
  }
});
