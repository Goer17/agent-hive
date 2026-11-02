import { useCallback, useEffect, useRef, useState } from "react";
import type { Agent, Message } from "../types";
import { api, ApiError } from "../api/client";
import { useMediaQuery, useSseEvent } from "../lib/hooks";
import { toast } from "../lib/toast";
import { ChatList } from "./chat/ChatList";
import { ChatWindow } from "./chat/ChatWindow";

function sortAgents(agents: Agent[]): Agent[] {
  return [...agents].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    if (left.order !== right.order) return left.order - right.order;
    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function ChatPage(): React.JSX.Element {
  const isMobile = useMediaQuery("(max-width: 820px)");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadedAgentId, setLoadedAgentId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const loadedAgentIdRef = useRef(loadedAgentId);
  loadedAgentIdRef.current = loadedAgentId;
  const messageRequestRef = useRef(0);

  const refreshAgents = useCallback(async (reportError = false): Promise<void> => {
    try {
      const next = await api.agents();
      setAgents(next);
      const active = selectedIdRef.current;
      if (active && !next.some((agent) => agent.sessionId === active)) {
        setSelectedId(null);
      }
    } catch (error) {
      if (reportError) {
        toast(error instanceof ApiError ? error.message : "Unable to load agents.");
      }
    } finally {
      setAgentsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshAgents(true);
  }, [refreshAgents]);

  const markRead = useCallback(async (agentId: string, force = false): Promise<void> => {
    const current = agentsRef.current.find((agent) => agent.sessionId === agentId);
    if (!force && (!current || current.unread === 0)) return;
    setAgents((items) =>
      items.map((agent) => (agent.sessionId === agentId ? { ...agent, unread: 0 } : agent)),
    );
    try {
      await api.updateAgent(agentId, { unread: 0 });
    } catch {
      // A subsequent refresh reconciles the unread state.
    }
  }, []);

  const loadInitial = useCallback(async (agentId: string): Promise<void> => {
    const requestId = ++messageRequestRef.current;
    setLoadingMessages(true);
    setLoadedAgentId(null);
    setMessages([]);
    setHasMore(false);
    try {
      const data = await api.agentMessages(agentId);
      if (requestId !== messageRequestRef.current || selectedIdRef.current !== agentId) return;
      setMessages(data.messages);
      setHasMore(data.hasMore);
      setLoadedAgentId(agentId);
    } catch (error) {
      if (requestId === messageRequestRef.current) {
        toast(error instanceof ApiError ? error.message : "Unable to load messages.");
      }
    } finally {
      if (requestId === messageRequestRef.current) setLoadingMessages(false);
    }
  }, []);

  const reloadLatest = useCallback(async (agentId: string): Promise<void> => {
    const requestId = ++messageRequestRef.current;
    try {
      const data = await api.agentMessages(agentId);
      if (requestId !== messageRequestRef.current || selectedIdRef.current !== agentId) return;
      setMessages((current) => {
        const byId = new Map(current.map((message) => [message.id, message]));
        for (const message of data.messages) byId.set(message.id, message);
        return [...byId.values()].sort((left, right) =>
          left.createdAt.localeCompare(right.createdAt),
        );
      });
      setLoadedAgentId(agentId);
    } catch {
      // Keep the current conversation on transient failures.
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      messageRequestRef.current += 1;
      setMessages([]);
      setLoadedAgentId(null);
      setHasMore(false);
      setLoadingMessages(false);
      return;
    }
    void loadInitial(selectedId);
    void markRead(selectedId);
  }, [selectedId, loadInitial, markRead]);

  useEffect(() => {
    if (isMobile || selectedId || agents.length === 0) return;
    setSelectedId(agents[0]?.sessionId ?? null);
  }, [agents, isMobile, selectedId]);

  useSseEvent((event) => {
    if (event.type === "message" || event.type === "agents") {
      void refreshAgents();
    }

    if (event.type !== "message") return;
    const active = selectedIdRef.current;
    if (!active) return;
    const agentIds = Array.isArray(event.data.agentIds)
      ? (event.data.agentIds as string[])
      : [];
    const conversation =
      typeof event.data.conversation === "string" ? event.data.conversation : "";
    if (agentIds.includes(active) || conversation === `u:${active}`) {
      void reloadLatest(active);
      void markRead(active, true);
    }
  });

  async function send(text: string, file: File | null): Promise<void> {
    const agentId = selectedIdRef.current;
    if (!agentId) throw new Error("No conversation selected.");
    setSending(true);
    try {
      const result = await api.sendAgentMessage(agentId, text, file);
      setMessages((current) =>
        current.some((message) => message.id === result.message.id)
          ? current
          : [...current, result.message],
      );
    } finally {
      setSending(false);
    }
  }

  async function loadOlder(): Promise<void> {
    const agentId = selectedIdRef.current;
    const first = messages[0];
    if (!agentId || !first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const data = await api.agentMessages(agentId, first.id);
      if (selectedIdRef.current !== agentId) return;
      setMessages((current) => [...data.messages, ...current]);
      setHasMore(data.hasMore);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function togglePin(agent: Agent): Promise<void> {
    const pinned = !agent.pinned;
    setAgents((items) =>
      sortAgents(
        items.map((item) => (item.sessionId === agent.sessionId ? { ...item, pinned } : item)),
      ),
    );
    try {
      await api.updateAgent(agent.sessionId, { pinned });
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to update pin.");
      void refreshAgents();
    }
  }

  async function markUnread(agent: Agent): Promise<void> {
    const unread = Math.max(1, agent.unread);
    setAgents((items) =>
      items.map((item) => (item.sessionId === agent.sessionId ? { ...item, unread } : item)),
    );
    try {
      await api.updateAgent(agent.sessionId, { unread });
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to mark unread.");
      void refreshAgents();
    }
  }

  async function reorder(orderedIds: string[]): Promise<void> {
    const byId = new Map(agentsRef.current.map((agent) => [agent.sessionId, agent]));
    const optimistic = orderedIds
      .map((id) => byId.get(id))
      .filter((agent): agent is Agent => Boolean(agent));
    if (optimistic.length === agentsRef.current.length) setAgents(optimistic);
    try {
      const result = await api.reorderAgents(orderedIds);
      setAgents(result.agents);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to reorder chats.");
      void refreshAgents();
    }
  }

  function handleUpdated(updated: Agent): void {
    setAgents((items) =>
      items.map((agent) => (agent.sessionId === updated.sessionId ? { ...agent, ...updated } : agent)),
    );
  }

  function handleDeleted(deleted: Agent): void {
    setAgents((items) => items.filter((agent) => agent.sessionId !== deleted.sessionId));
    if (selectedIdRef.current === deleted.sessionId) setSelectedId(null);
  }

  const selectedAgent = agents.find((agent) => agent.sessionId === selectedId) ?? null;
  const visibleMessages = loadedAgentId === selectedId ? messages : [];

  return (
    <div className={`chat-page${selectedId ? " has-selection" : ""}`}>
      <ChatList
        agents={agents}
        loading={!agentsLoaded}
        selectedId={selectedId}
        onSelect={(agent) => {
          if (agent.sessionId !== selectedId) setSelectedId(agent.sessionId);
        }}
        onTogglePin={(agent) => void togglePin(agent)}
        onMarkUnread={(agent) => void markUnread(agent)}
        onReorder={(ids) => void reorder(ids)}
      />
      <ChatWindow
        key={selectedId ?? "empty"}
        agent={selectedAgent}
        messages={visibleMessages}
        loading={Boolean(selectedId) && (loadingMessages || loadedAgentId !== selectedId)}
        loadingOlder={loadingOlder}
        hasMore={hasMore}
        sending={sending}
        onBack={() => setSelectedId(null)}
        onSend={send}
        onLoadMore={loadOlder}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  );
}