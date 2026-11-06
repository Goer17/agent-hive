import { MAX_FILES, MAX_TEXT_LENGTH, MAX_TOTAL_FILE_SIZE } from "../config.js";
import { newId } from "../lib/crypto.js";
import { publicFile, removeStoredFile } from "../lib/files.js";
import { badRequest } from "../lib/http.js";
import { store } from "../store/store.js";
import type {
  LastMessagePreview,
  MessagePublic,
  MessageRecord,
  StoredFile,
} from "../types.js";

export interface CreateMessageInput {
  conversation: string;
  from: MessageRecord["from"];
  text?: string;
  file?: StoredFile | null;
  files?: StoredFile[];
}

export const userConversation = (agentId: string): string => `u:${agentId}`;

export const pairConversation = (first: string, second: string): string =>
  `p:${[first, second].sort().join(":")}`;

export function createMessage(input: CreateMessageInput): MessageRecord {
  const text = (input.text ?? "").trim();
  const files = input.files ?? (input.file ? [input.file] : []);

  if (!text && files.length === 0) badRequest("A message needs text or a file.");
  if (files.length > MAX_FILES) {
    badRequest(`A message supports at most ${MAX_FILES} files.`);
  }
  const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalFileSize > MAX_TOTAL_FILE_SIZE) {
    badRequest("Attachments must total at most 100 MB.");
  }
  if (text.length > MAX_TEXT_LENGTH) {
    badRequest(`Text must be at most ${MAX_TEXT_LENGTH} characters.`);
  }

  const message: MessageRecord = {
    id: newId(),
    conversation: input.conversation,
    from: input.from,
    text,
    file: files[0] ?? null,
    files,
    createdAt: new Date().toISOString(),
    read: false,
  };
  store.data.messages.push(message);
  store.save();
  return message;
}

export function toPublicMessage(message: MessageRecord): MessagePublic {
  const files = message.files.map(publicFile);
  return {
    id: message.id,
    from: message.from,
    text: message.text,
    file: files[0] ?? null,
    files,
    createdAt: message.createdAt,
    read: message.read,
  };
}

export function listUserConversation(
  agentId: string,
  limit: number,
  beforeId?: string,
): { messages: MessagePublic[]; hasMore: boolean } {
  const all = store.data.messages.filter(
    (message) => message.conversation === userConversation(agentId),
  );

  let end = all.length;
  if (beforeId) {
    const index = all.findIndex((message) => message.id === beforeId);
    if (index === -1) badRequest("Unknown message cursor.");
    end = index;
  }

  const start = Math.max(0, end - limit);
  return {
    messages: all.slice(start, end).map(toPublicMessage),
    hasMore: start > 0,
  };
}

export function listPairMessages(first: string, second: string): MessagePublic[] {
  return store.data.messages
    .filter((message) => message.conversation === pairConversation(first, second))
    .map(toPublicMessage);
}

export function lastMessageForAgent(agentId: string): LastMessagePreview | null {
  const conversation = userConversation(agentId);
  for (let index = store.data.messages.length - 1; index >= 0; index -= 1) {
    const message = store.data.messages[index];
    if (message?.conversation === conversation) {
      const files = message.files.map(publicFile);
      return {
        text: message.text,
        file: files[0] ?? null,
        files,
        from: message.from,
        createdAt: message.createdAt,
        read: message.read,
      };
    }
  }
  return null;
}

function agentConversation(selfId: string, target: string): string {
  return target === "user" ? userConversation(selfId) : pairConversation(selfId, target);
}

export function listAgentConversation(
  selfId: string,
  target: "user" | string,
  last: number,
): MessageRecord[] {
  const conversation = agentConversation(selfId, target);
  return store.data.messages
    .filter((message) => message.conversation === conversation)
    .slice(-last);
}

function incomingTargetForAgent(
  message: MessageRecord,
  agentId: string,
): "user" | string | null {
  if (message.conversation === userConversation(agentId)) {
    return message.from.role === "user" ? "user" : null;
  }
  if (!message.conversation.startsWith("p:")) return null;
  const participants = message.conversation.slice(2).split(":");
  if (!participants.includes(agentId)) return null;
  if (message.from.role === "agent" && message.from.agentId === agentId) return null;
  const other = participants.find((id) => id !== agentId);
  return other ?? null;
}

export interface UnreadSummary {
  unreadCount: number;
  latest: {
    message: MessageRecord;
    target: "user" | string;
  } | null;
}

export function unreadSummary(agentId: string, target?: string): UnreadSummary {
  const conversation = target ? agentConversation(agentId, target) : null;
  let unreadCount = 0;
  let latest: UnreadSummary["latest"] = null;

  for (const message of store.data.messages) {
    if (message.read) continue;
    if (conversation && message.conversation !== conversation) continue;
    const messageTarget = incomingTargetForAgent(message, agentId);
    if (!messageTarget) continue;
    unreadCount += 1;
    latest = { message, target: messageTarget };
  }

  return { unreadCount, latest };
}

export function markAgentConversationRead(
  agentId: string,
  target: string,
  messageIds: string[],
): number {
  const conversation = agentConversation(agentId, target);
  const ids = new Set(messageIds);
  let marked = 0;

  for (const message of store.data.messages) {
    if (message.conversation !== conversation || !ids.has(message.id) || message.read) {
      continue;
    }
    if (!incomingTargetForAgent(message, agentId)) continue;
    message.read = true;
    marked += 1;
  }

  if (marked > 0) store.save();
  return marked;
}

export function markUserConversationRead(agentId: string): number {
  const conversation = userConversation(agentId);
  let marked = 0;

  for (const message of store.data.messages) {
    if (
      message.conversation === conversation &&
      message.from.role === "agent" &&
      message.from.agentId === agentId &&
      !message.read
    ) {
      message.read = true;
      marked += 1;
    }
  }

  if (marked > 0) store.save();
  return marked;
}

export function listAgentConversationAfter(
  selfId: string,
  target: "user" | string,
  afterId: string,
  limit = 200,
): MessageRecord[] {
  const conversation = agentConversation(selfId, target);
  const messages = store.data.messages.filter(
    (message) => message.conversation === conversation,
  );
  const index = messages.findIndex((message) => message.id === afterId);
  if (index === -1) badRequest("Unknown message cursor.");
  return messages.slice(index + 1, index + 1 + limit);
}

export function deleteConversation(conversation: string): number {
  const kept: MessageRecord[] = [];
  let removed = 0;
  for (const message of store.data.messages) {
    if (message.conversation === conversation) {
      for (const file of message.files) removeStoredFile(file);
      removed += 1;
    } else {
      kept.push(message);
    }
  }
  if (removed > 0) {
    store.data.messages = kept;
    store.save();
  }
  return removed;
}

export function deleteAllForAgent(agentId: string): number {
  const kept: MessageRecord[] = [];
  let removed = 0;

  for (const message of store.data.messages) {
    const isUserConversation = message.conversation === userConversation(agentId);
    const isPairConversation =
      message.conversation.startsWith("p:") && message.conversation.split(":").includes(agentId);
    if (isUserConversation || isPairConversation) {
      for (const file of message.files) removeStoredFile(file);
      removed += 1;
    } else {
      kept.push(message);
    }
  }

  if (removed > 0) {
    store.data.messages = kept;
    store.save();
  }
  return removed;
}

export function deletePairConversation(first: string, second: string): number {
  return deleteConversation(pairConversation(first, second));
}

export function fileById(
  fileId: string,
): { message: MessageRecord | null; file: StoredFile } | null {
  for (const message of store.data.messages) {
    const file = message.files.find((item) => item.id === fileId);
    if (file) return { message, file };
  }
  const upload = store.data.uploads.find((file) => file.id === fileId);
  return upload ? { message: null, file: upload } : null;
}

export function agentCanAccessFile(agentId: string, message: MessageRecord): boolean {
  if (message.conversation === userConversation(agentId)) return true;
  return (
    message.conversation.startsWith("p:") && message.conversation.split(":").includes(agentId)
  );
}

export function conversationParticipantIds(conversation: string): string[] {
  if (conversation.startsWith("u:")) return [conversation.slice(2)];
  if (conversation.startsWith("p:")) return conversation.slice(2).split(":");
  return [];
}