import { hashMatches, newId, randomToken, sha256 } from "../lib/crypto.js";
import { notFound } from "../lib/http.js";
import { store } from "../store/store.js";
import type { TokenRecord } from "../types.js";

export interface PublicToken {
  id: string;
  prefix: string;
  note: string;
  createdAt: string;
}

export function publicToken(token: TokenRecord): PublicToken {
  return {
    id: token.id,
    prefix: token.prefix,
    note: token.note,
    createdAt: token.createdAt,
  };
}

export function listTokens(): PublicToken[] {
  return [...store.data.tokens]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(publicToken);
}

export function createToken(note: string): { record: TokenRecord; token: string } {
  const token = randomToken(32);
  const record: TokenRecord = {
    id: newId(),
    tokenHash: sha256(token),
    prefix: token.slice(0, 8),
    note: note.trim().slice(0, 200),
    createdAt: new Date().toISOString(),
  };
  store.data.tokens.push(record);
  store.save();
  return { record, token };
}

export function updateTokenNote(tokenId: string, note: string): TokenRecord {
  const token = store.data.tokens.find((item) => item.id === tokenId);
  if (!token) notFound("Token not found.");
  token.note = note.trim().slice(0, 200);
  store.save();
  return token;
}

export function deleteToken(tokenId: string): TokenRecord {
  const token = store.data.tokens.find((item) => item.id === tokenId);
  if (!token) notFound("Token not found.");
  store.data.tokens = store.data.tokens.filter((item) => item.id !== tokenId);
  store.save();
  return token;
}

export function verifyAgentToken(token: string): TokenRecord | null {
  for (const record of store.data.tokens) {
    if (hashMatches(token, record.tokenHash)) return record;
  }
  return null;
}
