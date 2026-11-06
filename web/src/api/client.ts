import type {
  Agent,
  EdgeMessagesResponse,
  GeneratedToken,
  Message,
  PublicToken,
  Topology,
  TopologyEdge,
} from "../types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const UNAUTHORIZED_EVENT = "hive:unauthorized";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | object;
}

async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (body && typeof body !== "string" && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, body: body as BodyInit | null | undefined });
  } catch {
    throw new ApiError("Unable to reach the server.", 0);
  }

  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Keep the status-based message.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  status: () => request<{ authenticated: boolean }>("/api/auth/status"),
  login: (accessToken: string) =>
    request<{ authenticated: boolean }>("/api/auth/login", {
      method: "POST",
      body: { accessToken },
    }),

  agents: async () =>
    (await request<{ agents: Agent[] }>("/api/agents")).agents,
  updateAgent: async (
    id: string,
    update: { task?: string; pinned?: boolean; unread?: number; categoryId?: string },
  ) => (await request<{ agent: Agent }>(`/api/agents/${id}`, {
    method: "PATCH",
    body: update,
  })).agent,
  deleteAgent: (id: string) =>
    request<{ deleted: boolean }>(`/api/agents/${id}`, { method: "DELETE" }),
  reorderAgents: (order: string[]) =>
    request<{ agents: Agent[] }>("/api/agents/order", {
      method: "PUT",
      body: { order },
    }),

  agentMessages: (id: string, before?: string) =>
    request<{ messages: Message[]; hasMore: boolean }>(
      `/api/agents/${id}/messages?limit=100${before ? `&before=${encodeURIComponent(before)}` : ""}`,
    ),
  sendAgentMessage: (id: string, text: string, file: File | null) => {
    const body = new FormData();
    if (text) body.append("text", text);
    if (file) body.append("file", file);
    return request<{ message: Message }>(`/api/agents/${id}/messages`, {
      method: "POST",
      body,
    });
  },

  topology: () => request<Topology>("/api/topology"),
  createEdge: (a: string, b: string) =>
    request<{ edge: TopologyEdge }>("/api/topology/edges", {
      method: "POST",
      body: { a, b },
    }),
  deleteEdge: (id: string) =>
    request<{ deleted: boolean }>(`/api/topology/edges/${id}`, { method: "DELETE" }),
  edgeMessages: (id: string) =>
    request<EdgeMessagesResponse>(`/api/topology/edges/${id}/messages`),
  markEdgeRead: (id: string) =>
    request<{ ok: boolean; edgeId: string; unreadCount: number }>(
      `/api/topology/edges/${id}/read`,
      { method: "POST" },
    ),
  updatePositions: (positions: Record<string, { x: number; y: number }>) =>
    request<{ ok: boolean }>("/api/topology/positions", {
      method: "PATCH",
      body: { positions },
    }),

  createCategory: (name: string) =>
    request<{ category: { id: string; name: string } }>("/api/categories", {
      method: "POST",
      body: { name },
    }),
  renameCategory: (id: string, name: string) =>
    request<{ category: { id: string; name: string } }>(`/api/categories/${id}`, {
      method: "PATCH",
      body: { name },
    }),
  deleteCategory: (id: string) =>
    request<{ deleted: boolean }>(`/api/categories/${id}`, { method: "DELETE" }),

  tokens: async () =>
    (await request<{ tokens: PublicToken[] }>("/api/tokens")).tokens,
  createToken: (note = "") =>
    request<GeneratedToken>("/api/tokens", { method: "POST", body: { note } }),
  updateTokenNote: (id: string, note: string) =>
    request<{ token: PublicToken }>(`/api/tokens/${id}`, {
      method: "PATCH",
      body: { note },
    }),
  deleteToken: (id: string) =>
    request<{ deleted: boolean }>(`/api/tokens/${id}`, { method: "DELETE" }),
};