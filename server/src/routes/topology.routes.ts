import { Router } from "express";
import { z } from "zod";
import { events } from "../lib/events.js";
import { notFound } from "../lib/http.js";
import { store } from "../store/store.js";
import { requireBrowserAuth } from "../middleware/auth.js";
import { listPairMessages, pairConversation } from "../services/messages.service.js";
import {
  createEdge,
  deleteEdge,
  topologyPayload,
  updatePositions,
} from "../services/topology.service.js";

export const topologyRouter = Router();
topologyRouter.use(requireBrowserAuth);

topologyRouter.get("/", (_request, response) => {
  response.json(topologyPayload());
});

const edgeSchema = z.object({
  a: z.string().min(1),
  b: z.string().min(1),
});

topologyRouter.post("/edges", (request, response) => {
  const body = edgeSchema.parse(request.body);
  const edge = createEdge(body.a, body.b);
  events.emit({ type: "topology", data: {} });
  response.status(201).json({ edge });
});

topologyRouter.delete("/edges/:id", (request, response) => {
  const edge = deleteEdge(request.params.id);
  events.emit({
    type: "message",
    data: {
      conversation: pairConversation(edge.a, edge.b),
      agentIds: [edge.a, edge.b],
      deleted: true,
    },
  });
  events.emit({ type: "topology", data: {} });
  response.json({ deleted: true });
});

topologyRouter.get("/edges/:id/messages", (request, response) => {
  const edge = store.data.edges.find((item) => item.id === request.params.id);
  if (!edge) notFound("Connection not found.");
  response.json({
    messages: listPairMessages(edge.a, edge.b),
    edge: {
      ...edge,
      aName: store.data.agents.find((agent) => agent.sessionId === edge.a)?.name ?? "unknown",
      bName: store.data.agents.find((agent) => agent.sessionId === edge.b)?.name ?? "unknown",
    },
  });
});

const positionsSchema = z.object({
  positions: z.record(
    z.string(),
    z.object({
      x: z.number(),
      y: z.number(),
    }),
  ),
});

topologyRouter.patch("/positions", (request, response) => {
  const body = positionsSchema.parse(request.body);
  updatePositions(body.positions);
  events.emit({ type: "topology", data: {} });
  response.json({ ok: true });
});