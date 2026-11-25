import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, UPLOAD_DIR, UNCATEGORIZED_ID } from "../config.js";
import type { NotificationSettings, StoreData, UploadSettings } from "../types.js";

const STORE_FILE = path.join(DATA_DIR, "store.json");

function defaultNotifications(): NotificationSettings {
  return {
    enabled: false,
    email: null,
    smtpHost: null,
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: null,
    smtpPassword: null,
    smtpFrom: null,
    serverUrl: null,
  };
}

const DEFAULT_MAX_FILE_SIZE_MB = 200;
const MAX_CONFIGURED_FILE_SIZE_MB = 1024;

function defaultUploads(): UploadSettings {
  return { maxFileSizeMb: DEFAULT_MAX_FILE_SIZE_MB };
}

function normalizeUploads(value: unknown): UploadSettings {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const mb = Math.round(Number(raw.maxFileSizeMb));
  return {
    maxFileSizeMb: Number.isFinite(mb) && mb > 0
      ? Math.min(MAX_CONFIGURED_FILE_SIZE_MB, Math.max(1, mb))
      : DEFAULT_MAX_FILE_SIZE_MB,
  };
}

function normalizeNotifications(value: unknown): NotificationSettings {
  const defaults = defaultNotifications();
  if (!value || typeof value !== "object") return defaults;
  const raw = value as Record<string, unknown>;
  const text = (candidate: unknown): string | null =>
    typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
  const secret = (candidate: unknown): string | null =>
    typeof candidate === "string" && candidate.length > 0 ? candidate : null;
  const port = Number(raw.smtpPort);
  return {
    enabled: raw.enabled === true,
    email: text(raw.email),
    smtpHost: text(raw.smtpHost),
    smtpPort: Number.isInteger(port) && port > 0 && port <= 65535 ? port : defaults.smtpPort,
    smtpSecure: raw.smtpSecure === true,
    smtpUser: text(raw.smtpUser),
    smtpPassword: secret(raw.smtpPassword),
    smtpFrom: text(raw.smtpFrom),
    serverUrl: text(raw.serverUrl),
  };
}

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
    harnessMigrated: true,
    categories: [
      { id: UNCATEGORIZED_ID, name: "Uncategorized", order: 0, locked: true },
    ],
    tokens: [],
    usedAgentNames: [],
    settings: {
      notifications: defaultNotifications(),
      uploads: defaultUploads(),
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
  for (const agent of data.agents) {
    agent.harness ??= null;
    if (typeof agent.emailNotifications !== "boolean") agent.emailNotifications = true;
  }
  // One-time migration: the sessions that predate --harness all run on pi.
  if (!data.harnessMigrated) {
    for (const agent of data.agents) {
      if (!agent.harness) agent.harness = "pi";
    }
    data.harnessMigrated = true;
    writeStore(data);
  }
  data.messages ??= [];
  data.uploads ??= [];
  data.edges ??= [];
  data.edgeReads ??= {};
  data.categories ??= [];
  data.tokens ??= [];
  data.usedAgentNames ??= [];
  data.settings ??= { notifications: defaultNotifications(), uploads: defaultUploads() };
  data.settings.notifications = normalizeNotifications(data.settings.notifications);
  data.settings.uploads = normalizeUploads(data.settings.uploads);

  const missingReadFlags = data.messages.some(
    (message) => typeof (message as { read?: unknown }).read !== "boolean",
  );
  for (const message of data.messages) {
    if (typeof message.read !== "boolean") message.read = true;
  }

  // Normalize the legacy single-file field into the multi-file array.
  for (const message of data.messages) {
    const legacy = (message as unknown as { file?: (typeof message.files)[number] | null }).file ?? null;
    if (!Array.isArray(message.files)) message.files = legacy ? [legacy] : [];
    message.file = message.files[0] ?? null;
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

export function maxFileSizeMb(): number {
  return store.data.settings.uploads.maxFileSizeMb;
}

export function maxFileSizeBytes(): number {
  return maxFileSizeMb() * 1024 * 1024;
}

export { STORE_FILE };