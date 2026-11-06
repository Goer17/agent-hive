import fs from "node:fs";
import type { Request } from "express";
import { newId } from "./crypto.js";
import { normalizeFileName } from "./files.js";
import type { StoredFile } from "../types.js";

function uploadedFiles(request: Request): Express.Multer.File[] {
  const raw = request.files;
  if (!raw) return request.file ? [request.file] : [];
  if (Array.isArray(raw)) return raw;
  return Object.values(raw).flat();
}

export function fileFromRequest(request: Request): StoredFile | null {
  const file = request.file;
  if (!file) return null;
  return {
    id: newId(),
    name: normalizeFileName(file.originalname),
    size: file.size,
    mime: file.mimetype,
    storedName: file.filename,
  };
}

export function filesFromRequest(request: Request): StoredFile[] {
  return uploadedFiles(request).map((file) => ({
    id: newId(),
    name: normalizeFileName(file.originalname),
    size: file.size,
    mime: file.mimetype,
    storedName: file.filename,
  }));
}

export function discardUpload(request: Request): void {
  const file = request.file;
  if (!file) return;
  try {
    fs.unlinkSync(file.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Failed to discard upload ${file.path}:`, error);
    }
  }
}

export function discardUploads(request: Request): void {
  for (const file of uploadedFiles(request)) {
    try {
      fs.unlinkSync(file.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`Failed to discard upload ${file.path}:`, error);
      }
    }
  }
}