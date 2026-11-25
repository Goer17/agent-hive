import multer from "multer";
import crypto from "node:crypto";
import { MAX_FILES, UPLOAD_DIR } from "../config.js";
import { maxFileSizeBytes } from "../store/store.js";
import { extensionOf } from "../lib/files.js";

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, UPLOAD_DIR);
  },
  filename: (_request, file, callback) => {
    const extension = extensionOf(file.originalname);
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

function uploadForRequest() {
  return multer({
    storage,
    limits: {
      fileSize: maxFileSizeBytes(),
      files: MAX_FILES + 1,
    },
  });
}

export function messageUpload(request: import("express").Request, response: import("express").Response, next: import("express").NextFunction): void {
  uploadForRequest().fields([
    { name: "file", maxCount: 1 },
    { name: "files", maxCount: MAX_FILES },
  ])(request, response, next);
}

export function uploadSingle(field: string) {
  return (request: import("express").Request, response: import("express").Response, next: import("express").NextFunction): void => {
    uploadForRequest().single(field)(request, response, next);
  };
}
