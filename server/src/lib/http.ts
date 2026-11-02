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

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}