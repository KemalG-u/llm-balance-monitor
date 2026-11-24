// SPDX-License-Identifier: Apache-2.0
// Pure helpers for the LLM balance monitor (no file I/O), so they can be unit-tested.

export type AlertLevel = "critical" | "warning" | "ok";

export type ProviderResult = {
  ok?: boolean;
  balance?: number; // -1 means "no fixed limit" (pay-as-you-go)
  currency?: string;
  raw?: unknown;
  error?: string;
  alertLevel?: AlertLevel;
  alertMsg?: string;
};

export type Threshold = { warn: number; crit: number; currency: string };

export const THRESHOLDS: Record<string, Threshold> = {
  deepseek: { warn: 3, crit: 1, currency: "USD" },
  moonshot: { warn: 3, crit: 1, currency: "USD" },
  openrouter: { warn: 5, crit: 1, currency: "USD" },
};

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function classify(
  name: string,
  balance: number | undefined,
  thresholds: Record<string, Threshold> = THRESHOLDS,
): { level: AlertLevel; msg: string } | null {
  if (balance == null) return null;
  const t = thresholds[name];
  if (!t) return null;
  if (balance < 0) return { level: "ok", msg: `${name}: no fixed limit (pay-as-you-go)` };
  if (balance < t.crit) {
    return { level: "critical", msg: `CRITICAL ${name}: ${balance.toFixed(2)} ${t.currency} (below ${t.crit})` };
  }
  if (balance < t.warn) {
    return { level: "warning", msg: `WARNING ${name}: ${balance.toFixed(2)} ${t.currency} (below ${t.warn})` };
  }
  return { level: "ok", msg: `OK ${name}: ${balance.toFixed(2)} ${t.currency}` };
}

/** Parse KEY=VALUE lines (dotenv subset). Quotes around values are stripped. */
export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getJson(fetchFn: FetchLike, url: string, key: string): Promise<{ data?: any; error?: string }> {
  const r = await withTimeout(fetchFn(url, { headers: { Authorization: `Bearer ${key}` } }), 15000);
  if (!r.ok) return { error: `HTTP ${r.status}` };
  return { data: await r.json() };
}

type Env = Record<string, string | undefined>;

export async function checkDeepSeek(env: Env, fetchFn: FetchLike): Promise<ProviderResult> {
  const key = env.DEEPSEEK_API_KEY;
  if (!key) return { error: "DEEPSEEK_API_KEY is not set" };
  try {
    const { data: d, error } = await getJson(fetchFn, "https://api.deepseek.com/user/balance", key);
    if (error) return { error };
    const usd = d.balance_infos?.find((b: any) => b.currency === "USD");
    return { ok: d.is_available === true, balance: parseFloat(usd?.total_balance ?? "0"), currency: "USD", raw: d };
  } catch (e: any) {
    return { error: e.message };
  }
}

// Moonshot has two separate platforms: api.moonshot.ai (international, USD) and
// api.moonshot.cn (China, CNY). Keys are not interchangeable; override with MOONSHOT_BASE_URL.
export async function checkMoonshot(env: Env, fetchFn: FetchLike): Promise<ProviderResult> {
  const key = env.MOONSHOT_API_KEY;
  if (!key) return { error: "MOONSHOT_API_KEY is not set" };
  const base = env.MOONSHOT_BASE_URL || "https://api.moonshot.ai";
  try {
    const { data: d, error } = await getJson(fetchFn, `${base}/v1/users/me/balance`, key);
    if (error) return { error };
    return {
      ok: true,
      balance: parseFloat(d.data?.available_balance ?? "0"),
      currency: base.endsWith(".cn") ? "CNY" : "USD",
      raw: d.data,
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function checkOpenRouter(env: Env, fetchFn: FetchLike): Promise<ProviderResult> {
  const key = env.OPENROUTER_API_KEY;
  if (!key) return { error: "OPENROUTER_API_KEY is not set" };
  try {
    const { data: d, error } = await getJson(fetchFn, "https://openrouter.ai/api/v1/auth/key", key);
    if (error) return { error };
    const usage = d.data?.usage ?? 0;
    const limit = d.data?.limit;
    return { ok: true, balance: limit != null ? limit - usage : -1, currency: "USD", raw: d.data };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** Keep only the most recent `max` history entries. */
export function trimHistory<T>(history: T[], max = 90): T[] {
  return history.length > max ? history.slice(-max) : history;
}
