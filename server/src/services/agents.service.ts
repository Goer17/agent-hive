import { AVATAR_COUNT, UNCATEGORIZED_ID } from "../config.js";
import {
  hashSessionPassword,
  newId,
  randomInt,
  randomSessionPassword,
  randomToken,
} from "../lib/crypto.js";
import { conflict, notFound } from "../lib/http.js";
import { store } from "../store/store.js";
import { FIRST_NAMES, LAST_NAMES } from "../store/names.js";
import type { AgentPublic, AgentRecord, AgentWithPreview } from "../types.js";
import { lastMessageForAgent } from "./messages.service.js";

export function toPublicAgent(agent: AgentRecord): AgentPublic {
  return {
    sessionId: agent.sessionId,
    name: agent.name,
    host: agent.host,
    workspace: agent.workspace,
    task: agent.task,
    harness: agent.harness,
    avatar: agent.avatar,
    createdAt: agent.createdAt,
    order: agent.order,
    pinned: agent.pinned,
    unread: agent.unread,
    categoryId: agent.categoryId,
    graph: agent.graph,
  };
}

export function listAgents(): AgentWithPreview[] {
  return [...store.data.agents]
    .sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
      if (left.order !== right.order) return left.order - right.order;
      return left.createdAt.localeCompare(right.createdAt);
    })
    .map((agent) => ({
      ...toPublicAgent(agent),
      lastMessage: lastMessageForAgent(agent.sessionId),
    }));
}

export function findAgent(agentId: string): AgentRecord | undefined {
  return store.data.agents.find((agent) => agent.sessionId === agentId);
}

export function requireAgent(agentId: string): AgentRecord {
  const agent = findAgent(agentId);
  if (!agent) notFound("Agent not found.");
  return agent;
}

function generateAgentName(): string {
  const used = new Set(store.data.usedAgentNames);
  const existing = new Set(store.data.agents.map((agent) => agent.name));
  const isTaken = (name: string): boolean => used.has(name) || existing.has(name);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const first = FIRST_NAMES[randomInt(FIRST_NAMES.length)];
    const last = LAST_NAMES[randomInt(LAST_NAMES.length)];
    const candidate = `${first}-${last}`;
    if (!isTaken(candidate)) return candidate;
  }

  const first = FIRST_NAMES[randomInt(FIRST_NAMES.length)];
  const last = LAST_NAMES[randomInt(LAST_NAMES.length)];
  const base = `${first}-${last}`;
  let suffix = 2;
  while (isTaken(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function pickAvatar(): number {
  const used = new Set(store.data.agents.map((agent) => agent.avatar));
  const available: number[] = [];
  for (let index = 1; index <= AVATAR_COUNT; index += 1) {
    if (!used.has(index)) available.push(index);
  }
  if (available.length > 0) {
    return available[randomInt(available.length)] as number;
  }
  return randomInt(AVATAR_COUNT) + 1;
}

function initialGraphPosition(index: number): { x: number; y: number } {
  const goldenAngle = 2.399963229728653;
  const angle = index * goldenAngle;
  const radius = 170 + (index % 4) * 68;
  return {
    x: Math.round(600 + Math.cos(angle) * radius + randomInt(40) - 20),
    y: Math.round(360 + Math.sin(angle) * radius + randomInt(40) - 20),
  };
}

export interface RegisterAgentInput {
  host: string;
  workspace: string;
  task: string;
  harness?: string | null;
}

export function createAgent(input: RegisterAgentInput): {
  agent: AgentRecord;
  sessionPassword: string;
} {
  const sessionId = newId();
  const sessionPassword = randomSessionPassword();
  const sessionPwdSalt = randomToken(16);
  const now = new Date().toISOString();
  const name = generateAgentName();
  const maxOrder = store.data.agents.reduce(
    (maximum, agent) => Math.max(maximum, agent.order),
    -1,
  );

  const agent: AgentRecord = {
    sessionId,
    name,
    sessionPwdSalt,
    sessionPwdHash: hashSessionPassword(sessionPassword, sessionPwdSalt),
    host: input.host,
    workspace: input.workspace,
    task: input.task,
    harness: input.harness?.trim().toLowerCase() || null,
    avatar: pickAvatar(),
    createdAt: now,
    order: maxOrder + 1,
    pinned: false,
    unread: 0,
    categoryId: UNCATEGORIZED_ID,
    graph: initialGraphPosition(store.data.agents.length),
  };

  store.data.agents.push(agent);
  store.data.usedAgentNames.push(name);
  store.save();

  return { agent, sessionPassword };
}

export interface AgentUpdate {
  task?: string;
  pinned?: boolean;
  unread?: number;
  categoryId?: string;
}

export function updateAgent(agentId: string, update: AgentUpdate): AgentRecord {
  const agent = requireAgent(agentId);

  if (update.task !== undefined) {
    const task = update.task.trim();
    if (!task) conflict("Task cannot be empty.");
    if (task.length > 200) conflict("Task must be at most 200 characters.");
    agent.task = task;
  }

  if (update.pinned !== undefined) agent.pinned = update.pinned;

  if (update.unread !== undefined) {
    if (!Number.isInteger(update.unread) || update.unread < 0 || update.unread > 999) {
      conflict("Unread count must be between 0 and 999.");
    }
    agent.unread = update.unread;
  }

  if (update.categoryId !== undefined) {
    const category = store.data.categories.find((item) => item.id === update.categoryId);
    if (!category) conflict("Category not found.");
    agent.categoryId = update.categoryId;
  }

  store.save();
  return agent;
}

export function reorderAgents(orderedIds: string[]): void {
  const ids = new Set(orderedIds);
  if (ids.size !== store.data.agents.length) {
    conflict("The order must contain every agent exactly once.");
  }
  for (const agent of store.data.agents) {
    if (!ids.has(agent.sessionId)) {
      conflict("The order must contain every agent exactly once.");
    }
  }
  orderedIds.forEach((id, index) => {
    const agent = requireAgent(id);
    agent.order = index;
  });
  store.save();
}

export function deleteAgent(agentId: string): AgentRecord {
  const agent = requireAgent(agentId);
  store.data.agents = store.data.agents.filter((item) => item.sessionId !== agentId);
  store.data.edges = store.data.edges.filter(
    (edge) => edge.a !== agentId && edge.b !== agentId,
  );
  store.save();
  return agent;
}