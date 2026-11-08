import { Router } from "express";
import { z } from "zod";
import { clampInt, queryString } from "../lib/http.js";
import { events } from "../lib/events.js";
import { discardUploads, filesFromRequest } from "../lib/uploads.js";
import { store } from "../store/store.js";
import {
  deleteAgent,
  listAgents,
  requireAgent,
  reorderAgents,
  toPublicAgent,
  updateAgent,
} from "../services/agents.service.js";
import {
  createMessage,
  deleteAllForAgent,
  listUserConversation,
  markUserConversationRead,
  toPublicMessage,
  userConversation,
  conversationParticipantIds,
} from "../services/messages.service.js";
import { messageUpload } from "../middleware/upload.js";
import { requireBrowserAuth } from "../middleware/auth.js";

export const agentsRouter = Router();
agentsRouter.use(requireBrowserAuth);

agentsRouter.get("/", (_request, response) => {
  response.json({ agents: listAgents() });
});

const reorderSchema = z.object({
  order: z.array(z.string()).max(10_000),
});

agentsRouter.put("/order", (request, response) => {
  const body = reorderSchema.parse(request.body);
  reorderAgents(body.order);
  response.json({ agents: listAgents() });
});

const updateSchema = z.object({
  task: z.string().optional(),
  pinned: z.boolean().optional(),
  unread: z.number().int().optional(),
  emailNotifications: z.boolean().optional(),
  categoryId: z.string().optional(),
});

agentsRouter.patch("/:id", (request, response) => {
  const body = updateSchema.parse(request.body);
  const agent = updateAgent(request.params.id, body);
  if (body.unread === 0) markUserConversationRead(agent.sessionId);
  events.emit({ type: "agents", data: {} });
  if (body.categoryId !== undefined) {
    events.emit({ type: "topology", data: {} });
  }
  response.json({ agent: toPublicAgent(agent) });
});

agentsRouter.delete("/:id", (request, response) => {
  const agent = requireAgent(request.params.id);
  deleteAgent(agent.sessionId);
  deleteAllForAgent(agent.sessionId);
  events.emit({ type: "agents", data: {} });
  events.emit({ type: "topology", data: {} });
  response.json({ deleted: true });
});

agentsRouter.get("/:id/messages", (request, response) => {
  const agent = requireAgent(request.params.id);
  const limit = clampInt(queryString(request.query.limit), 100, 1, 200);
  const before = queryString(request.query.before) || undefined;
  const result = listUserConversation(agent.sessionId, limit, before);
  response.json({ messages: result.messages, hasMore: result.hasMore });
});

agentsRouter.post(
  "/:id/messages",
  messageUpload,
  (request, response, next) => {
    try {
      const agent = requireAgent(String(request.params.id));
      const text = typeof request.body.text === "string" ? request.body.text : "";
      const files = filesFromRequest(request);
      const message = createMessage({
        conversation: userConversation(agent.sessionId),
        from: { role: "user", name: "user" },
        text,
        files,
      });
      if (agent.unread !== 0) {
        agent.unread = 0;
        store.save();
      }
      markUserConversationRead(agent.sessionId);
      events.emit({
        type: "message",
        data: {
          conversation: message.conversation,
          agentIds: conversationParticipantIds(message.conversation),
          messageId: message.id,
          from: "user",
        },
      });
      events.emit({ type: "agents", data: {} });
      response.status(201).json({ message: toPublicMessage(message) });
    } catch (error) {
      discardUploads(request);
      next(error);
    }
  },
);