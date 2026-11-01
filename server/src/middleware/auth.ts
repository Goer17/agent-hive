import type { NextFunction, Request, Response } from "express";
import { HttpError, unauthorized } from "../lib/http.js";
import { verifySessionPassword } from "../lib/crypto.js";
import { store } from "../store/store.js";
import type { AgentRecord } from "../types.js";
import { tokenFromRequest, verifyAccessToken } from "../services/auth.service.js";

export type AgentRequest = Request & { agent: AgentRecord };

export function requireBrowserAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  const token = tokenFromRequest(request.headers);
  if (!verifyAccessToken(token)) {
    next(new HttpError(401, "Authentication required."));
    return;
  }
  next();
}

export function requireAgentAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  const sessionId = request.header("x-hive-session-id");
  const sessionPassword = request.header("x-hive-session-pwd");

  if (!sessionId || !sessionPassword) {
    next(unauthorized("Missing agent credentials."));
    return;
  }

  const agent = store.data.agents.find((candidate) => candidate.sessionId === sessionId);
  if (!agent || !verifySessionPassword(sessionPassword, agent.sessionPwdSalt, agent.sessionPwdHash)) {
    next(unauthorized("Invalid agent credentials."));
    return;
  }

  (request as AgentRequest).agent = agent;
  next();
}