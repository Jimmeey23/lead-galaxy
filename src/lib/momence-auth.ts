import { createHmac, randomUUID } from "node:crypto";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

const AUTH_ORIGIN = "https://api.momence.com";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
const deviceData = { browser: USER_AGENT, screen: { width: 1470, height: 956 } };
const state = globalThis as typeof globalThis & {
  __momenceRenewal?: Promise<string>;
  __momenceRetryAfter?: number;
};

export function momenceConfigured() {
  return !!(process.env.MOMENCE_ALL_COOKIES || (
    process.env.MOMENCE_EMAIL && process.env.MOMENCE_PASSWORD && process.env.MOMENCE_TOTP_SECRET
  ));
}

/** RFC 6238: Momence's existing shared-secret TOTP flow (SHA-1, 30s, 6 digits). */
export function generateTotp(secret: string, now = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.toUpperCase().replace(/[\s=]/g, "")) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error("MOMENCE_TOTP_SECRET must be a valid base32 secret.");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g)?.map((byte) => parseInt(byte, 2)) ?? [];
  if (!bytes.length) throw new Error("MOMENCE_TOTP_SECRET is empty.");
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hash = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

export function mergeCookies(current: string, headers: Headers): string {
  const jar = new Map(current.split(";").map((pair): [string, string] => {
    const index = pair.indexOf("=");
    return index > 0 ? [pair.slice(0, index).trim(), pair.slice(index + 1).trim()] : ["", ""];
  }).filter(([key]) => key));
  for (const raw of headers.getSetCookie()) {
    const pair = raw.split(";", 1)[0];
    const index = pair.indexOf("=");
    if (index < 1) continue;
    const name = pair.slice(0, index).trim();
    if (/max-age\s*=\s*0(?:;|$)/i.test(raw)) jar.delete(name);
    else jar.set(name, pair.slice(index + 1));
  }
  return [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function persistCookies(cookies: string) {
  // Hosted function filesystems cannot persist deployment environment variables.
  if (process.env.VERCEL || process.env.MOMENCE_PERSIST_ENV === "false") return;
  const file = path.join(process.cwd(), ".env.local");
  const existing = await readFile(file, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "";
    throw new Error("Unable to read .env.local for Momence session persistence.");
  });
  const line = `MOMENCE_ALL_COOKIES=${JSON.stringify(cookies)}`;
  let replaced = false;
  const lines = existing.split(/\r?\n/).filter((entry) => {
    if (!/^\s*(?:export\s+)?MOMENCE_ALL_COOKIES\s*=/.test(entry)) return true;
    if (replaced) return false;
    replaced = true;
    return true;
  }).map((entry) => /^\s*(?:export\s+)?MOMENCE_ALL_COOKIES\s*=/.test(entry) ? line : entry);
  if (!replaced) lines.push(line);
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, lines.join("\n").replace(/\n*$/, "\n"), { mode: 0o600, flag: "wx" });
    await rename(temporary, file);
  } catch {
    await unlink(temporary).catch(() => {});
    throw new Error("Momence renewed, but .env.local could not be updated. Check file permissions.");
  }
}

async function authenticate(): Promise<string> {
  const email = process.env.MOMENCE_EMAIL;
  const password = process.env.MOMENCE_PASSWORD;
  const secret = process.env.MOMENCE_TOTP_SECRET;
  if (!email || !password || !secret) {
    throw new Error("Momence session expired or missing. Configure MOMENCE_EMAIL, MOMENCE_PASSWORD and MOMENCE_TOTP_SECRET for automatic renewal.");
  }
  const login = await fetch(`${AUTH_ORIGIN}/auth/login`, {
    method: "POST", headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({ email, password, deviceData }), cache: "no-store",
    signal: AbortSignal.timeout(15_000), redirect: "error",
  });
  if (!login.ok) throw new Error(`Momence login failed (${login.status}). Check login credentials.`);
  const loginCookies = mergeCookies("", login.headers);
  if (!loginCookies) throw new Error("Momence login returned no session cookies.");
  await login.body?.cancel();
  const mfa = await fetch(`${AUTH_ORIGIN}/auth/mfa/totp/verify`, {
    method: "POST", headers: { "content-type": "application/json", cookie: loginCookies, "user-agent": USER_AGENT },
    body: JSON.stringify({ token: generateTotp(secret), deviceData, trustDevice: true }),
    cache: "no-store", signal: AbortSignal.timeout(15_000), redirect: "error",
  });
  if (!mfa.ok) throw new Error(`Momence MFA failed (${mfa.status}). Check the TOTP secret and server clock.`);
  const cookies = mergeCookies(loginCookies, mfa.headers);
  if (!mfa.headers.getSetCookie().length) throw new Error("Momence MFA did not return refreshed session cookies.");
  await mfa.body?.cancel();
  await persistCookies(cookies);
  process.env.MOMENCE_ALL_COOKIES = cookies;
  return cookies;
}

async function renewCookies(rejected?: string) {
  const current = process.env.MOMENCE_ALL_COOKIES;
  if (rejected && current && current !== rejected) return current;
  if (!state.__momenceRenewal) {
    if (Date.now() < (state.__momenceRetryAfter ?? 0)) throw new Error("Momence session renewal failed recently. Retry after one minute.");
    state.__momenceRenewal = authenticate().catch(() => {
      state.__momenceRetryAfter = Date.now() + 60_000;
      throw new Error("Momence session renewal failed. Check MOMENCE_EMAIL, MOMENCE_PASSWORD, MOMENCE_TOTP_SECRET and .env.local permissions.");
    }).finally(() => { state.__momenceRenewal = undefined; });
  }
  return state.__momenceRenewal;
}

/** Only Momence requests are allowed. Retry authentication failure once, never other failures. */
export async function momenceFetch(url: string, init: RequestInit = {}) {
  const target = new URL(url);
  if (target.origin !== "https://momence.com" || !target.pathname.startsWith("/_api/")) {
    throw new Error("Invalid Momence API destination.");
  }
  const send = (cookies: string) => {
    const headers = new Headers(init.headers);
    headers.set("cookie", cookies);
    return fetch(target.href, { ...init, headers, cache: "no-store", redirect: "manual", signal: init.signal ?? AbortSignal.timeout(20_000) });
  };
  const cookies = process.env.MOMENCE_ALL_COOKIES || await renewCookies();
  const response = await send(cookies);
  const redirectedToLogin = response.status >= 300 && response.status < 400 && /login|auth|sign-in/i.test(response.headers.get("location") ?? "");
  if (response.status !== 401 && response.status !== 403 && !redirectedToLogin) return response;
  await response.body?.cancel();
  return send(await renewCookies(cookies));
}
