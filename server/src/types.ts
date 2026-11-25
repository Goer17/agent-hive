export interface AgentRecord {
  sessionId: string;
  name: string;
  sessionPwdSalt: string;
  sessionPwdHash: string;
  host: string;
  workspace: string;
  task: string;
  harness: string | null;
  avatar: number;
  createdAt: string;
  order: number;
  pinned: boolean;
  unread: number;
  emailNotifications: boolean;
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
  files: StoredFile[];
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
  enabled: boolean;
  email: string | null;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  serverUrl: string | null;
}

export interface UploadSettings {
  maxFileSizeMb: number;
}

export interface PublicNotificationSettings {
  enabled: boolean;
  email: string | null;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPasswordSet: boolean;
  smtpFrom: string | null;
  serverUrl: string | null;
  configured: boolean;
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
  edgeReads: Record<string, string>;
  edgeReadsMigrated: boolean;
  harnessMigrated: boolean;
  categories: CategoryRecord[];
  tokens: TokenRecord[];
  usedAgentNames: string[];
  settings: {
    notifications: NotificationSettings;
    uploads: UploadSettings;
  };
}

export interface AgentPublic {
  sessionId: string;
  name: string;
  host: string;
  workspace: string;
  task: string;
  harness: string | null;
  avatar: number;
  createdAt: string;
  order: number;
  pinned: boolean;
  unread: number;
  emailNotifications: boolean;
  categoryId: string;
  graph: { x: number; y: number };
}

export interface MessagePublic {
  id: string;
  from: MessageRecord["from"];
  text: string;
  file: PublicFile | null;
  files: PublicFile[];
  createdAt: string;
  read: boolean;
}

export interface LastMessagePreview {
  text: string;
  file: PublicFile | null;
  files: PublicFile[];
  from: MessageRecord["from"];
  createdAt: string;
  read: boolean;
}

export interface AgentWithPreview extends AgentPublic {
  lastMessage: LastMessagePreview | null;
}