import multer from "multer";
import crypto from "node:crypto";
import { MAX_FILE_SIZE, UPLOAD_DIR } from "../config.js";
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

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});