import { Router } from "express";
import { z } from "zod";
import {
  clearedSessionCookie,
  ensureAccessToken,
  sessionCookie,
  tokenFromRequest,
  verifyAccessToken,
} from "../services/auth.service.js";
import { HttpError } from "../lib/http.js";

export const authRouter = Router();

const loginSchema = z.object({
  accessToken: z.string().min(1, "Access token is required."),
});

authRouter.post("/login", (request, response) => {
  ensureAccessToken();
  const body = loginSchema.parse(request.body);
  if (!verifyAccessToken(body.accessToken)) {
    throw new HttpError(401, "Invalid access token.");
  }
  response.setHeader("Set-Cookie", sessionCookie(body.accessToken));
  response.json({ authenticated: true });
});

authRouter.get("/status", (request, response) => {
  const authenticated = verifyAccessToken(tokenFromRequest(request.headers));
  response.json({ authenticated });
});

authRouter.post("/logout", (_request, response) => {
  response.setHeader("Set-Cookie", clearedSessionCookie());
  response.json({ authenticated: false });
});