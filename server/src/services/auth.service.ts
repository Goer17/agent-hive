import fs from "node:fs";
import { ACCESS_TOKEN_ENV, ACCESS_TOKEN_FILE, DATA_DIR, SESSION_COOKIE } from "../config.js";
import { hashMatches, randomToken, sha256 } from "../lib/crypto.js";
import { store } from "../store/store.js";

let cachedToken: string | null = null;

export function ensureAccessToken(): string {
  if (cachedToken) return cachedToken;

  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

  if (ACCESS_TOKEN_ENV) {
    cachedToken = ACCESS_TOKEN_ENV;
  } else if (fs.existsSync(ACCESS_TOKEN_FILE)) {
    cachedToken = fs.readFileSync(ACCESS_TOKEN_FILE, "utf8").trim();
  }

  if (!cachedToken) {
    cachedToken = randomToken(32);
    fs.writeFileSync(ACCESS_TOKEN_FILE, `${cachedToken}\n`, { mode: 0o600 });
  }

  const tokenHash = sha256(cachedToken);
  if (store.data.accessTokenHash !== tokenHash) {
    store.data.accessTokenHash = tokenHash;
    store.save();
  }

  return cachedToken;
}

export function verifyAccessToken(token: string | null | undefined): boolean {
  if (!token || !store.data.accessTokenHash) return false;
  return hashMatches(token, store.data.accessTokenHash);
}

export function tokenFromRequest(headers: {
  authorization?: string | undefined;
  cookie?: string | undefined;
}): string | null {
  const authorization = headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const cookie = parseCookies(headers.cookie ?? "");
  return cookie[SESSION_COOKIE] ?? null;
}

export function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

export function sessionCookie(token: string): string {
  const maxAge = 365 * 24 * 60 * 60;
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}