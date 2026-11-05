export interface AgentRecord {
  sessionId: string;
  name: string;
  sessionPwdSalt: string;
  sessionPwdHash: string;
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
}

export interface StoredFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  storedName: string;
}

export interface PublicFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  url: string;
  downloadUrl: string;
}

export interface MessageRecord {
  id: string;
  conversation: string;
  from: {
    role: "user" | "agent";
    agentId?: string;
    name: string;
  };
  text: string;
  file: StoredFile | null;
  createdAt: string;
  read: boolean;
}

export interface EdgeRecord {
  id: string;
  a: string;
  b: string;
  createdAt: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  order: number;
  locked?: boolean;
}

export interface TokenRecord {
  id: string;
  tokenHash: string;
  prefix: string;
  note: string;
  createdAt: string;
}

export interface NotificationSettings {
  email: string | null;
  enabled: boolean;
}

export interface StoreData {
  version: 1;
  createdAt: string;
  updatedAt: string;
  accessTokenHash: string | null;
  agents: AgentRecord[];
  messages: MessageRecord[];
  uploads: StoredFile[];
  edges: EdgeRecord[];
  categories: CategoryRecord[];
  tokens: TokenRecord[];
  usedAgentNames: string[];
  settings: {
    notifications: NotificationSettings;
  };
}

export interface AgentPublic {
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
}

export interface MessagePublic {
  id: string;
  from: MessageRecord["from"];
  text: string;
  file: PublicFile | null;
  createdAt: string;
  read: boolean;
}

export interface LastMessagePreview {
  text: string;
  file: PublicFile | null;
  from: MessageRecord["from"];
  createdAt: string;
  read: boolean;
}

export interface AgentWithPreview extends AgentPublic {
  lastMessage: LastMessagePreview | null;
}