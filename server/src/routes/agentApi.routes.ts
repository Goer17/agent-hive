import { Router } from "express";
import { z } from "zod";
import { badRequest, clampInt, HttpError, queryString } from "../lib/http.js";
import { events } from "../lib/events.js";
import { publicFile, sendStoredFile } from "../lib/files.js";
import { discardUpload, discardUploads, fileFromRequest, filesFromRequest } from "../lib/uploads.js";
import { store } from "../store/store.js";
import { requireAgentAuth, type AgentRequest } from "../middleware/auth.js";
import { messageUpload, upload } from "../middleware/upload.js";
import { createAgent } from "../services/agents.service.js";
import {
  agentCanAccessFile,
  createMessage,
  fileById,
  listAgentConversation,
  listAgentConversationAfter,
  markAgentConversationRead,
  unreadSummary,
  userConversation,
} from "../services/messages.service.js";
import { notifyUserMessage } from "../services/notifications.js";
import {
  contactsForAgent,
  agentConversationTarget,
} from "../services/topology.service.js";
import { verifyAgentToken } from "../services/tokens.service.js";
import type { MessageRecord } from "../types.js";

export const agentApiRouter = Router();

const registerSchema = z.object({
  token: z.string().min(1, "Token is required."),
  workspace: z.string().trim().max(1000).optional().default("."),
  task: z.string().trim().min(1, "Task is required.").max(200),
  harness: z.string().trim().max(60).optional(),
  host: z.string().trim().max(200).optional(),
});

agentApiRouter.post("/register", async (request, response) => {
  const body = registerSchema.parse(request.body);
  const tokenRecord = verifyAgentToken(body.token);
  if (!tokenRecord) {
    throw new HttpError(401, "Invalid token.");
  }

  const host = (body.host?.trim() || request.ip || "unknown").slice(0, 200);
  const workspace = body.workspace.trim() || ".";
  const { agent, sessionPassword } = createAgent({
    host,
    workspace,
    task: body.task,
    harness: body.harness,
  });

  const text = `Registered using token ${tokenRecord.prefix}-***.`;
  const registrationMessage = createMessage({
    conversation: userConversation(agent.sessionId),
    from: {
      role: "agent",
      agentId: agent.sessionId,
      name: agent.name,
    },
    text,
  });
  agent.unread = Math.min(999, agent.unread + 1);
  store.save();
  await notifyUserMessage({ agent, message: registrationMessage });

  events.emit({
    type: "message",
    data: {
      conversation: registrationMessage.conversation,
      agentIds: [agent.sessionId],
      messageId: registrationMessage.id,
      from: agent.sessionId,
    },
  });
  events.emit({ type: "agents", data: {} });
  events.emit({ type: "topology", data: {} });

  response.status(201).json({
    session_id: agent.sessionId,
    session_pwd: sessionPassword,
    name: agent.name,
    host: agent.host,
    workspace: agent.workspace,
    task: agent.task,
    harness: agent.harness,
  });
});

agentApiRouter.use(requireAgentAuth);

agentApiRouter.get("/me", (request, response) => {
  const agent = (request as AgentRequest).agent;
  response.json({
    session_id: agent.sessionId,
    name: agent.name,
    host: agent.host,
    workspace: agent.workspace,
    task: agent.task,
  });
});

agentApiRouter.get("/contacts", (request, response) => {
  const agent = (request as AgentRequest).agent;
  response.json({ contacts: contactsForAgent(agent.sessionId) });
});

agentApiRouter.get("/unread", (request, response) => {
  const agent = (request as AgentRequest).agent;
  const target = (queryString(request.query.with) ?? "").trim();
  if (target) agentConversationTarget(agent, target);
  const summary = unreadSummary(agent.sessionId, target || undefined);
  const latest = summary.latest;

  response.json({
    unread_count: summary.unreadCount,
    latest: latest
      ? {
          id: latest.message.id,
          from: {
            session_id: latest.message.from.agentId ?? "user",
            name: latest.message.from.name,
            type: latest.message.from.role,
          },
          created_at: latest.message.createdAt,
          target: latest.target,
        }
      : null,
  });
});

function agentMessagePayload(message: MessageRecord): Record<string, unknown> {
  const files = message.files.map((file) => ({
    id: file.id,
    name: file.name,
    size: file.size,
    mime: file.mime,
    url: `/api/agent/files/${file.id}`,
    download_url: `/api/agent/files/${file.id}?download=1`,
  }));
  return {
    id: message.id,
    from: {
      role: message.from.role,
      name: message.from.name,
      ...(message.from.agentId ? { agent_id: message.from.agentId } : {}),
    },
    text: message.text,
    file: files[0] ?? null,
    files,
    created_at: message.createdAt,
    read: message.read,
  };
}

agentApiRouter.get("/messages", (request, response) => {
  const agent = (request as AgentRequest).agent;
  const target = (queryString(request.query.with) ?? "user").trim() || "user";
  const last = clampInt(queryString(request.query.last), 10, 1, 200);
  const resolved = agentConversationTarget(agent, target);
  const after = queryString(request.query.after);
  const messages = after
    ? listAgentConversationAfter(agent.sessionId, target, after)
    : listAgentConversation(agent.sessionId, target, last);

  const contact =
    resolved.type === "user"
      ? { session_id: "user", name: "user", type: "user" as const }
      : {
          session_id: resolved.other?.sessionId ?? target,
          name: resolved.other?.name ?? target,
          task: resolved.other?.task,
          type: "agent" as const,
        };

  response.json({
    contact,
    messages: messages.map(agentMessagePayload),
  });
});

const readSchema = z.object({
  with: z.string().min(1).max(200),
  ids: z.array(z.string().min(1)).max(200),
});

agentApiRouter.post("/messages/read", (request, response) => {
  const agent = (request as AgentRequest).agent;
  const body = readSchema.parse(request.body);
  const resolved = agentConversationTarget(agent, body.with);
  const marked = markAgentConversationRead(agent.sessionId, body.with, body.ids);

  if (marked > 0) {
    events.emit({
      type: "message",
      data: {
        conversation: resolved.conversation,
        agentIds: [
          agent.sessionId,
          ...(resolved.other ? [resolved.other.sessionId] : []),
        ],
        read: true,
      },
    });
  }

  response.json({ marked });
});

agentApiRouter.post(
  "/messages",
  messageUpload,
  async (request, response, next) => {
    try {
      const agent = (request as AgentRequest).agent;
      const target = (typeof request.body.to === "string" ? request.body.to.trim() : "") || "user";
      const text = typeof request.body.text === "string" ? request.body.text : "";
      const files = filesFromRequest(request);
      const resolved = agentConversationTarget(agent, target);

      const message = createMessage({
        conversation: resolved.conversation,
        from: {
          role: "agent",
          agentId: agent.sessionId,
          name: agent.name,
        },
        text,
        files,
      });

      if (resolved.type === "user") {
        agent.unread = Math.min(999, agent.unread + 1);
        store.save();
        await notifyUserMessage({ agent, message });
      }

      events.emit({
        type: "message",
        data: {
          conversation: message.conversation,
          agentIds: [agent.sessionId, ...(resolved.other ? [resolved.other.sessionId] : [])],
          messageId: message.id,
          from: agent.sessionId,
        },
      });
      if (resolved.type === "user") {
        events.emit({ type: "agents", data: {} });
      }

      response.status(201).json({
        ok: true,
        message: agentMessagePayload(message),
      });
    } catch (error) {
      discardUploads(request);
      next(error);
    }
  },
);

agentApiRouter.post("/files", upload.single("file"), (request, response, next) => {
  try {
    const file = fileFromRequest(request);
    if (!file) badRequest("A file is required.");
    store.data.uploads.push(file);
    store.save();
    response.status(201).json({ file: publicFile(file) });
  } catch (error) {
    discardUpload(request);
    next(error);
  }
});

agentApiRouter.get("/files/:id", (request, response) => {
  const agent = (request as unknown as AgentRequest).agent;
  const found = fileById(request.params.id);
  if (!found || (found.message && !agentCanAccessFile(agent.sessionId, found.message))) {
    response.status(404).json({ error: "File not found." });
    return;
  }
  sendStoredFile(response, found.file, { download: queryString(request.query.download) === "1" });
});
