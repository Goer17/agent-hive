import { Router } from "express";
import { z } from "zod";
import { events } from "../lib/events.js";
import { requireBrowserAuth } from "../middleware/auth.js";
import {
  createToken,
  deleteToken,
  listTokens,
  publicToken,
  updateTokenNote,
} from "../services/tokens.service.js";

export const tokensRouter = Router();
tokensRouter.use(requireBrowserAuth);

tokensRouter.get("/", (_request, response) => {
  response.json({ tokens: listTokens() });
});

const noteSchema = z.object({
  note: z.string().max(200).optional(),
});

tokensRouter.post("/", (request, response) => {
  const body = noteSchema.parse(request.body);
  const { record, token } = createToken(body.note ?? "");
  events.emit({ type: "tokens", data: {} });
  response.status(201).json({
    token,
    ...publicToken(record),
  });
});

tokensRouter.patch("/:id", (request, response) => {
  const body = noteSchema.parse(request.body);
  const token = updateTokenNote(request.params.id, body.note ?? "");
  events.emit({ type: "tokens", data: {} });
  response.json({ token: publicToken(token) });
});
tokensRouter.delete("/:id", (request, response) => {
  deleteToken(request.params.id);
  events.emit({ type: "tokens", data: {} });
  response.json({ deleted: true });
});
