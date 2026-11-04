import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link2, Loader2, Trash2, X } from "lucide-react";
import type { Message, TopologyAgent, TopologyEdge } from "../../types";
import { api } from "../../api/client";
import { FileAttachment } from "../../components/FileAttachment";
import { Markdown } from "../../components/Markdown";
import { formatTimestamp, pairKey } from "../../lib/format";
import { useSseEvent } from "../../lib/hooks";
import { toast } from "../../lib/toast";

interface EdgeConversationPanelProps {
  edge: TopologyEdge;
  agents: TopologyAgent[];
  onClose: () => void;
  onDeleteRequest: (edge: TopologyEdge) => void;
}

export function EdgeConversationPanel({
  edge,
  agents,
  onClose,
  onDeleteRequest,
}: EdgeConversationPanelProps): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  const first = agents.find((agent) => agent.sessionId === edge.a);
  const second = agents.find((agent) => agent.sessionId === edge.b);
  const firstName = first?.name ?? "unknown";
  const secondName = second?.name ?? "unknown";

  async function load(): Promise<void> {
    const requestId = ++requestRef.current;
    try {
      const data = await api.edgeMessages(edge.id);
      if (requestId !== requestRef.current) return;
      setMessages(data.messages);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to load connection.");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    void load();
    return () => {
      requestRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edge.id]);

  useSseEvent((event) => {
    if (event.type !== "message") return;
    const agentIds = Array.isArray(event.data.agentIds)
      ? (event.data.agentIds as string[])
      : [];
    if (event.data.deleted) {
      if (pairKey(edge.a, edge.b) === pairKey(agentIds[0] ?? "", agentIds[1] ?? "")) {
        onClose();
      }
      return;
    }
    if (agentIds.includes(edge.a) && agentIds.includes(edge.b)) {
      void load();
    }
  });

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  function handleMediaLoad(): void {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }

  return (
    <section className="edge-panel" aria-label={`Conversation between ${firstName} and ${secondName}`}>
      <header className="edge-panel-header">
        <span className="edge-panel-icon">
          <Link2 size={15} />
        </span>
        <div className="edge-panel-title">
          <h2>
            {firstName}
            <span> ↔ </span>
            {secondName}
          </h2>
          <p>{messages.length} {messages.length === 1 ? "message" : "messages"}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Delete connection"
          title="Delete connection"
          onClick={() => onDeleteRequest(edge)}
        >
          <Trash2 size={15} />
        </button>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      <div className="edge-panel-body" ref={scrollRef}>
        {loading ? (
          <div className="chat-loading">
            <Loader2 size={17} className="spin" />
          </div>
        ) : null}
        {!loading && messages.length === 0 ? (
          <p className="empty-note centered">No messages yet.</p>
        ) : null}
        {messages.map((message) => (
          <article key={message.id} className="edge-message">
            <div className="edge-message-meta">
              <span>{message.from.name}</span>
              <span className="edge-message-state">
                <time dateTime={message.createdAt}>{formatTimestamp(message.createdAt)}</time>
                <span className={`message-read${message.read ? " is-read" : ""}`}>
                  {message.read ? "Read" : "Unread"}
                </span>
              </span>
            </div>
            <div className="edge-message-bubble">
              {message.file ? (
                <FileAttachment file={message.file} compact onMediaLoad={handleMediaLoad} />
              ) : null}
              {message.text ? <Markdown text={message.text} /> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}