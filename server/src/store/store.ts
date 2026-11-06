import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, UPLOAD_DIR, UNCATEGORIZED_ID } from "../config.js";
import type { StoreData } from "../types.js";

const STORE_FILE = path.join(DATA_DIR, "store.json");

function freshStore(): StoreData {
  const now = new Date().toISOString();
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    accessTokenHash: null,
    agents: [],
    messages: [],
    uploads: [],
    edges: [],
    edgeReads: {},
    edgeReadsMigrated: true,
    categories: [
      { id: UNCATEGORIZED_ID, name: "Uncategorized", order: 0, locked: true },
    ],
    tokens: [],
    usedAgentNames: [],
    settings: {
      notifications: { email: null, enabled: false },
    },
  };
}

function ensureDirectories(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });
}

function loadStore(): StoreData {
  ensureDirectories();
  if (!fs.existsSync(STORE_FILE)) {
    const data = freshStore();
    writeStore(data);
    return data;
  }

  const raw = fs.readFileSync(STORE_FILE, "utf8");
  let data: StoreData;
  try {
    data = JSON.parse(raw) as StoreData;
  } catch {
    throw new Error(`Unable to parse data store at ${STORE_FILE}.`);
  }

  if (data.version !== 1) {
    throw new Error(`Unsupported data store version: ${String(data.version)}.`);
  }

  data.agents ??= [];
  data.messages ??= [];
  data.uploads ??= [];
  data.edges ??= [];
  data.edgeReads ??= {};
  data.categories ??= [];
  data.tokens ??= [];
  data.usedAgentNames ??= [];
  data.settings ??= { notifications: { email: null, enabled: false } };
  data.settings.notifications ??= { email: null, enabled: false };

  const missingReadFlags = data.messages.some(
    (message) => typeof (message as { read?: unknown }).read !== "boolean",
  );
  for (const message of data.messages) {
    if (typeof message.read !== "boolean") message.read = true;
  }
  if (missingReadFlags) {
    for (const agent of data.agents) {
      if (!agent.unread) continue;
      const conversation = `u:${agent.sessionId}`;
      const pending = data.messages
        .filter(
          (message) =>
            message.conversation === conversation && message.from.role === "agent",
        )
        .slice(-agent.unread);
      for (const message of pending) message.read = false;
    }
  }

  if (!data.categories.some((category) => category.id === UNCATEGORIZED_ID)) {
    data.categories.unshift({
      id: UNCATEGORIZED_ID,
      name: "Uncategorized",
      order: 0,
      locked: true,
    });
  }

  // One-time migration: existing edge conversations should not suddenly show
  // as unread. Mark each edge as read up to its newest message; later messages
  // are counted normally.
  if (!data.edgeReadsMigrated) {
    for (const edge of data.edges) {
      const conversation = `p:${[edge.a, edge.b].sort().join(":")}`;
      for (let index = data.messages.length - 1; index >= 0; index -= 1) {
        const message = data.messages[index];
        if (message?.conversation === conversation) {
          data.edgeReads[edge.id] = message.id;
          break;
        }
      }
    }
    data.edgeReadsMigrated = true;
    writeStore(data);
  }

  return data;
}

function writeStore(data: StoreData): void {
  ensureDirectories();
  data.updatedAt = new Date().toISOString();
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, STORE_FILE);
}

class Store {
  readonly data: StoreData;

  constructor() {
    this.data = loadStore();
  }

  save(): void {
    writeStore(this.data);
  }
}

export const store = new Store();
export { STORE_FILE };