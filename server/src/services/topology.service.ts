import { newId } from "../lib/crypto.js";
import { conflict, notFound } from "../lib/http.js";
import { store } from "../store/store.js";
import type { AgentRecord, CategoryRecord, EdgeRecord } from "../types.js";
import { requireAgent } from "./agents.service.js";
import {
  deletePairConversation,
  pairConversation,
  userConversation,
} from "./messages.service.js";
import { UNCATEGORIZED_ID } from "../config.js";

export interface TopologyAgent {
  sessionId: string;
  name: string;
  task: string;
  host: string;
  workspace: string;
  avatar: number;
  categoryId: string;
  graph: { x: number; y: number };
}

export interface TopologyEdge {
  id: string;
  a: string;
  b: string;
  createdAt: string;
  messageCount: number;
}

export interface TopologyPayload {
  agents: TopologyAgent[];
  edges: TopologyEdge[];
  categories: CategoryRecord[];
}

export function listCategories(): CategoryRecord[] {
  return [...store.data.categories].sort((left, right) => left.order - right.order);
}

export function topologyPayload(): TopologyPayload {
  const agents = store.data.agents
    .map((agent) => ({
      sessionId: agent.sessionId,
      name: agent.name,
      task: agent.task,
      host: agent.host,
      workspace: agent.workspace,
      avatar: agent.avatar,
      categoryId: agent.categoryId,
      graph: agent.graph,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const edges = store.data.edges.map((edge) => ({
    ...edge,
    messageCount: store.data.messages.filter(
      (message) => message.conversation === pairConversation(edge.a, edge.b),
    ).length,
  }));

  return { agents, edges, categories: listCategories() };
}

export function areConnected(first: string, second: string): boolean {
  return store.data.edges.some(
    (edge) =>
      (edge.a === first && edge.b === second) || (edge.a === second && edge.b === first),
  );
}

export function createEdge(first: string, second: string): EdgeRecord {
  requireAgent(first);
  requireAgent(second);
  if (first === second) conflict("An agent cannot be connected to itself.");
  if (areConnected(first, second)) conflict("These agents are already connected.");

  const edge: EdgeRecord = {
    id: newId(),
    a: first,
    b: second,
    createdAt: new Date().toISOString(),
  };
  store.data.edges.push(edge);
  store.save();
  return edge;
}

export function deleteEdge(edgeId: string): EdgeRecord {
  const edge = store.data.edges.find((item) => item.id === edgeId);
  if (!edge) notFound("Connection not found.");
  store.data.edges = store.data.edges.filter((item) => item.id !== edgeId);
  store.save();
  deletePairConversation(edge.a, edge.b);
  return edge;
}

export function updatePositions(
  positions: Record<string, { x: number; y: number }>,
): void {
  for (const [agentId, position] of Object.entries(positions)) {
    const agent = requireAgent(agentId);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      conflict("Invalid node position.");
    }
    agent.graph = {
      x: Math.round(Math.min(5000, Math.max(-2000, position.x))),
      y: Math.round(Math.min(5000, Math.max(-2000, position.y))),
    };
  }
  store.save();
}

export function createCategory(name: string): CategoryRecord {
  const trimmed = name.trim();
  if (!trimmed) conflict("Category name cannot be empty.");
  if (trimmed.length > 40) conflict("Category name must be at most 40 characters.");
  const duplicate = store.data.categories.some(
    (category) => category.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (duplicate) conflict("A category with that name already exists.");

  const maxOrder = store.data.categories.reduce(
    (maximum, category) => Math.max(maximum, category.order),
    0,
  );
  const category: CategoryRecord = {
    id: newId(),
    name: trimmed,
    order: maxOrder + 1,
  };
  store.data.categories.push(category);
  store.save();
  return category;
}

export function renameCategory(categoryId: string, name: string): CategoryRecord {
  const category = store.data.categories.find((item) => item.id === categoryId);
  if (!category) notFound("Category not found.");
  if (category.locked) conflict("The default category cannot be renamed.");

  const trimmed = name.trim();
  if (!trimmed) conflict("Category name cannot be empty.");
  if (trimmed.length > 40) conflict("Category name must be at most 40 characters.");
  const duplicate = store.data.categories.some(
    (item) =>
      item.id !== categoryId && item.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (duplicate) conflict("A category with that name already exists.");

  category.name = trimmed;
  store.save();
  return category;
}

export function removeCategory(categoryId: string): void {
  const category = store.data.categories.find((item) => item.id === categoryId);
  if (!category) notFound("Category not found.");
  if (category.locked) conflict("The default category cannot be deleted.");

  store.data.categories = store.data.categories.filter((item) => item.id !== categoryId);
  for (const agent of store.data.agents) {
    if (agent.categoryId === categoryId) agent.categoryId = UNCATEGORIZED_ID;
  }
  store.save();
}

export interface AgentContact {
  session_id: string;
  name: string;
  task?: string;
  type: "user" | "agent";
}

export function contactsForAgent(agentId: string): AgentContact[] {
  requireAgent(agentId);
  const connected = store.data.edges
    .filter((edge) => edge.a === agentId || edge.b === agentId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((edge) => requireAgent(edge.a === agentId ? edge.b : edge.a));

  const contacts: AgentContact[] = [
    { session_id: "user", name: "user", type: "user" },
    ...connected
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((agent) => ({
        session_id: agent.sessionId,
        name: agent.name,
        task: agent.task,
        type: "agent" as const,
      })),
  ];
  return contacts;
}

export function agentConversationTarget(
  agent: AgentRecord,
  target: string,
): { conversation: string; type: "user" | "agent"; other?: AgentRecord } {
  if (target === "user") {
    return { conversation: userConversation(agent.sessionId), type: "user" };
  }
  if (target === agent.sessionId) conflict("An agent cannot message itself.");
  const other = requireAgent(target);
  if (!areConnected(agent.sessionId, target)) {
    conflict("That agent is not in your contacts.");
  }
  return {
    conversation: pairConversation(agent.sessionId, target),
    type: "agent",
    other,
  };
}