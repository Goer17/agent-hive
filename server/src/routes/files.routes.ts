import { Router } from "express";
import { requireBrowserAuth } from "../middleware/auth.js";
import { sendStoredFile } from "../lib/files.js";
import { fileById } from "../services/messages.service.js";
import { queryString } from "../lib/http.js";

export const filesRouter = Router();
filesRouter.use(requireBrowserAuth);

filesRouter.get("/:id", (request, response) => {
  const found = fileById(request.params.id);
  if (!found) {
    response.status(404).json({ error: "File not found." });
    return;
  }
  sendStoredFile(response, found.file, { download: queryString(request.query.download) === "1" });
});