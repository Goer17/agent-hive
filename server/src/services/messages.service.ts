import { MAX_TEXT_LENGTH } from "../config.js";
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
}

export const userConversation = (agentId: string): string => `u:${agentId}`;

export const pairConversation = (first: string, second: string): string =>
  `p:${[first, second].sort().join(":")}`;

export function createMessage(input: CreateMessageInput): MessageRecord {
  const text = (input.text ?? "").trim();
  const file = input.file ?? null;

  if (!text && !file) badRequest("A message needs text or a file.");
  if (text.length > MAX_TEXT_LENGTH) {
    badRequest(`Text must be at most ${MAX_TEXT_LENGTH} characters.`);
  }

  const message: MessageRecord = {
    id: newId(),
    conversation: input.conversation,
    from: input.from,
    text,
    file,
    createdAt: new Date().toISOString(),
  };
  store.data.messages.push(message);
  store.save();
  return message;
}

export function toPublicMessage(message: MessageRecord): MessagePublic {
  return {
    id: message.id,
    from: message.from,
    text: message.text,
    file: message.file ? publicFile(message.file) : null,
    createdAt: message.createdAt,
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
      return {
        text: message.text,
        file: message.file ? publicFile(message.file) : null,
        from: message.from,
        createdAt: message.createdAt,
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
      if (message.file) removeStoredFile(message.file);
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
      if (message.file) removeStoredFile(message.file);
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

export function fileById(fileId: string): { message: MessageRecord; file: StoredFile } | null {
  for (const message of store.data.messages) {
    if (message.file?.id === fileId) return { message, file: message.file };
  }
  return null;
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