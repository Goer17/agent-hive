export type Role = "user" | "agent";

export interface MessageFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  url: string;
  downloadUrl: string;
}

export interface Message {
  id: string;
  from: {
    role: Role;
    agentId?: string;
    name: string;
  };
  text: string;
  file: MessageFile | null;
  createdAt: string;
  read: boolean;
}

export interface LastMessagePreview {
  text: string;
  file: MessageFile | null;
  from: Message["from"];
  createdAt: string;
  read: boolean;
}

export interface Agent {
  sessionId: string;
  name: string;
  host: string;
  workspace: string;
  task: string;
  avatar: number;
  createdAt: string;
  order: number;
  pinned: boolean;
  unread: number;
  categoryId: string;
  graph: { x: number; y: number };
  lastMessage: LastMessagePreview | null;
}

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

export interface Category {
  id: string;
  name: string;
  order: number;
  locked?: boolean;
}

export interface Topology {
  agents: TopologyAgent[];
  edges: TopologyEdge[];
  categories: Category[];
}

export interface PublicToken {
  id: string;
  prefix: string;
  note: string;
  createdAt: string;
}

export interface GeneratedToken extends PublicToken {
  token: string;
}

export interface EdgeMessagesResponse {
  messages: Message[];
  edge: TopologyEdge & { aName: string; bName: string };
}

export interface SseEventDetail {
  type: "agents" | "topology" | "message" | "tokens";
  data: Record<string, unknown>;
}