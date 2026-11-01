import crypto from "node:crypto";

export function newId(): string {
  return crypto.randomUUID();
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function randomSessionPassword(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashMatches(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(sha256(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function hashSessionPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

export function verifySessionPassword(
  password: string,
  salt: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(hashSessionPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function randomInt(maxExclusive: number): number {
  return crypto.randomInt(maxExclusive);
}