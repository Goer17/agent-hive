import { localAddresses } from "../config.js";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}

export function notFound(message = "Not found."): never {
  throw new HttpError(404, message);
}

export function conflict(message: string): never {
  throw new HttpError(409, message);
}

export function forbidden(message: string): never {
  throw new HttpError(403, message);
}

export function unauthorized(message = "Authentication required."): never {
  throw new HttpError(401, message);
}

export function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function clampInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Like requestOrigin, but replace localhost/loopback with the first local IPv4. */
export function serverOrigin(request: import("express").Request): string {
  const origin = requestOrigin(request);
  try {
    const url = new URL(origin);
    if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
      const [address] = localAddresses();
      if (address) {
        url.hostname = address;
        return url.origin;
      }
    }
  } catch {
    // Fall through to the raw origin.
  }
  return origin;
}

/** Public origin of the incoming request, honouring reverse-proxy headers. */
export function requestOrigin(request: import("express").Request): string {
  const forwardedProto = request.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto = forwardedProto || request.protocol || "http";
  const host = forwardedHost || request.get("host") || request.hostname || "localhost";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}