import multer from "multer";
import crypto from "node:crypto";
import { MAX_FILES, MAX_FILE_SIZE, UPLOAD_DIR } from "../config.js";
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
    files: MAX_FILES + 1,
  },
});
export const messageUpload = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "files", maxCount: MAX_FILES },
]);
