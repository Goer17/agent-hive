import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(currentDir, "..");
export const REPO_ROOT = path.resolve(SERVER_ROOT, "..");

export const PORT = Number(process.env.PORT ?? 3000);
export const HOST = process.env.HOST ?? "0.0.0.0";
export const DATA_DIR = path.resolve(process.env.HIVE_DATA_DIR ?? path.join(SERVER_ROOT, "data"));
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const ACCESS_TOKEN_FILE = path.join(DATA_DIR, "access-token.txt");
export const WEB_DIST_DIR = path.resolve(
  process.env.HIVE_WEB_DIST ?? path.join(REPO_ROOT, "web", "dist"),
);

export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_TEXT_LENGTH = 20_000;
export const SESSION_COOKIE = "hive_token";
export const ACCESS_TOKEN_ENV = process.env.HIVE_ACCESS_TOKEN?.trim() || null;

export const AVATAR_COUNT = 24;
export const UNCATEGORIZED_ID = "uncategorized";

export function localAddresses(): string[] {
  const addresses = new Set<string>();
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.add(entry.address);
      }
    }
  }
  return [...addresses];
}