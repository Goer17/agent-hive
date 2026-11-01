import fs from "node:fs";
import path from "node:path";
import type { Response } from "express";
import { UPLOAD_DIR } from "../config.js";
import type { PublicFile, StoredFile } from "../types.js";

const INLINE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
};

const EXTENSION_TYPES: Record<string, string> = {
  ...INLINE_TYPES,
  pdf: "application/pdf",
  json: "application/json",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  zip: "application/zip",
  tar: "application/x-tar",
  gz: "application/gzip",
};

export function extensionOf(fileName: string): string {
  return path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 12);
}

export function normalizeFileName(input: string): string {
  let name = input;
  // multer/busboy can expose UTF-8 names as latin1.
  const decoded = Buffer.from(input, "latin1").toString("utf8");
  if (!decoded.includes("\uFFFD")) name = decoded;
  name = path.basename(name).replace(/[\r\n\t]/g, " ").trim();
  if (!name) name = "file";
  return name.slice(0, 255);
}

export function storedFilePath(storedName: string): string {
  const resolved = path.resolve(UPLOAD_DIR, storedName);
  if (!resolved.startsWith(`${UPLOAD_DIR}${path.sep}`)) {
    throw new Error("Invalid stored file path.");
  }
  return resolved;
}

export function removeStoredFile(file: StoredFile): void {
  try {
    fs.unlinkSync(storedFilePath(file.storedName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Failed to remove upload ${file.storedName}:`, error);
    }
  }
}

export function contentTypeFor(file: StoredFile): string {
  const ext = extensionOf(file.name).slice(1);
  return EXTENSION_TYPES[ext] ?? "application/octet-stream";
}

export function isInlineSafe(file: StoredFile): boolean {
  const ext = extensionOf(file.name).slice(1);
  return ext in INLINE_TYPES;
}

function contentDisposition(file: StoredFile, download: boolean): string {
  const asciiName = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(file.name);
  const mode = download || !isInlineSafe(file) ? "attachment" : "inline";
  return `${mode}; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
}

export function sendStoredFile(
  response: Response,
  file: StoredFile,
  options: { download?: boolean } = {},
): void {
  const filePath = storedFilePath(file.storedName);
  if (!fs.existsSync(filePath)) {
    response.status(404).json({ error: "File is no longer available." });
    return;
  }

  response.setHeader("Content-Type", contentTypeFor(file));
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "private, max-age=3600");
  response.setHeader("Content-Disposition", contentDisposition(file, Boolean(options.download)));
  response.sendFile(filePath, (error) => {
    if (error && !response.headersSent) {
      response.status(404).json({ error: "File is no longer available." });
    }
  });
}

export function publicFile(file: StoredFile): PublicFile {
  return {
    ...file,
    url: `/api/files/${file.id}`,
    downloadUrl: `/api/files/${file.id}?download=1`,
  };
}