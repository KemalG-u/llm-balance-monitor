#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
/**
 * LLM balance monitor: checks prepaid balances of a few LLM API providers
 * (DeepSeek, Moonshot/Kimi, OpenRouter), writes a JSON state file with history,
 * prints warnings below configurable thresholds.
 *
 * Run:   bun run check-balances.ts      (or: node check-balances.ts on a Node version with TypeScript type stripping)
 * Exit:  0 = all fine, 2 = at least one alert, 1 = unexpected failure.
 *
 * Configuration (environment variables; never put keys in this repo):
 *   DEEPSEEK_API_KEY, MOONSHOT_API_KEY, OPENROUTER_API_KEY   provider keys (each optional)
 *   LLM_MONITOR_ENV_FILE   optional path to a .env-style file to read the keys from
 *   LLM_MONITOR_DATA_DIR   where balance-state.json is written (default: ./data)
 *   MOONSHOT_BASE_URL      default https://api.moonshot.ai (https://api.moonshot.cn for the China platform)
 *
 * TLS certificates are always verified.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  checkDeepSeek,
  checkMoonshot,
  checkOpenRouter,
  classify,
  parseEnvText,
  trimHistory,
  type ProviderResult,
} from "./lib.ts";

const env: Record<string, string | undefined> = { ...process.env };
const envFile = process.env.LLM_MONITOR_ENV_FILE;
if (envFile) {
  if (!existsSync(envFile)) {
    console.error(`LLM_MONITOR_ENV_FILE not found: ${envFile}`);
    process.exit(1);
  }
  // real environment variables win over the file
  Object.assign(env, { ...parseEnvText(readFileSync(envFile, "utf8")), ...process.env });
}

const outDir = resolve(process.env.LLM_MONITOR_DATA_DIR || "./data");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const providers: Record<string, ProviderResult> = {
  deepseek: await checkDeepSeek(env, fetch as any),
  moonshot: await checkMoonshot(env, fetch as any),
  openrouter: await checkOpenRouter(env, fetch as any),
};

const alerts: { provider: string; level: string; msg: string }[] = [];
for (const [name, data] of Object.entries(providers)) {
  if (data.error) {
    alerts.push({ provider: name, level: "error", msg: `${name}: could not read balance (${data.error})` });
    continue;
  }
  const c = classify(name, data.balance);
  if (c) {
    data.alertLevel = c.level;
    data.alertMsg = c.msg;
    if (c.level !== "ok") alerts.push({ provider: name, level: c.level, msg: c.msg });
  }
}

const outPath = join(outDir, "balance-state.json");
let history: any[] = [];
if (existsSync(outPath)) {
  try {
    const old = JSON.parse(readFileSync(outPath, "utf8"));
    history = Array.isArray(old.history) ? old.history : [];
  } catch {
    // corrupted state file: start a fresh history
  }
}
history.push({
  ts: generatedAt,
  providers: Object.fromEntries(
    Object.entries(providers).map(([k, v]) => [k, { balance: v.balance, currency: v.currency, error: v.error }]),
  ),
});
history = trimHistory(history, 90);

writeFileSync(outPath, JSON.stringify({ generatedAt, providers, alerts, history, schemaVersion: 1 }, null, 2));

console.log(`=== LLM balances: ${generatedAt} ===`);
for (const [name, data] of Object.entries(providers)) {
  if (data.error) console.log(`  ${name}: ERROR ${data.error}`);
  else if (data.alertMsg) console.log(`  ${data.alertMsg}`);
  else if (data.balance != null) console.log(`  ${name}: ${data.balance.toFixed(2)} ${data.currency ?? ""}`);
}

if (alerts.length > 0) {
  console.log(`\n--- ${alerts.length} alert(s) ---`);
  for (const a of alerts) console.log(`  ${a.msg}`);
  process.exit(2);
}
console.log("\nAll balances above thresholds.");
