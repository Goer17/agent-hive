import { useRef, useState } from "react";
import {
  Ellipsis,
  Loader2,
  Mail,
  Paperclip,
  Pin,
  PinOff,
} from "lucide-react";
import type { Agent } from "../../types";
import { Avatar } from "../../components/Avatar";
import { ContextMenu } from "../../components/ContextMenu";
import { formatListTime, previewText } from "../../lib/format";

interface ChatListProps {
  agents: Agent[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (agent: Agent) => void;
  onTogglePin: (agent: Agent) => void;
  onMarkUnread: (agent: Agent) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function ChatList({
  agents,
  loading,
  selectedId,
  onSelect,
  onTogglePin,
  onMarkUnread,
  onReorder,
}: ChatListProps): React.JSX.Element {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [orderOverride, setOrderOverride] = useState<Agent[] | null>(null);
  const [menu, setMenu] = useState<{ agent: Agent; x: number; y: number } | null>(null);
  const displayAgents = orderOverride ?? agents;
  const displayAgentsRef = useRef(displayAgents);
  displayAgentsRef.current = displayAgents;

  function openMenu(agent: Agent, x: number, y: number): void {
    setMenu({ agent, x, y });
  }

  function handleDragEnter(targetId: string): void {
    if (!draggingId || draggingId === targetId) return;
    const current = displayAgentsRef.current;
    const from = current.findIndex((agent) => agent.sessionId === draggingId);
    const to = current.findIndex((agent) => agent.sessionId === targetId);
    if (from === -1 || to === -1) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    displayAgentsRef.current = next;
    setOrderOverride(next);
  }

  return (
    <section className="chat-list-panel" aria-label="Conversations">
      <header className="chat-list-header">
        <div className="section-heading">
          <h1>Chats</h1>
          <span className="section-count">{agents.length}</span>
        </div>
      </header>
      <div className="chat-list">
        {loading && agents.length === 0 ? (
          <div className="list-loading">
            <Loader2 size={16} className="spin" />
          </div>
        ) : null}
        {!loading && agents.length === 0 ? (
          <p className="empty-note">No agents yet.</p>
        ) : null}
        {displayAgents.map((agent) => {
          const last = agent.lastMessage;
          const preview = last
            ? last.file
              ? last.text
                ? `${previewText(last.text, 48)} · ${last.file.name}`
                : last.file.name
              : previewText(last.text)
            : "No messages yet.";
          return (
            <div
              key={agent.sessionId}
              className={[
                "chat-row",
                agent.sessionId === selectedId ? "is-active" : "",
                agent.sessionId === draggingId ? "is-dragging" : "",
              ].join(" ")}
              role="button"
              tabIndex={0}
              draggable
              onClick={() => onSelect(agent)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(agent);
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                onSelect(agent);
                openMenu(agent, event.clientX, event.clientY);
              }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", agent.sessionId);
                setDraggingId(agent.sessionId);
                setOrderOverride([...displayAgentsRef.current]);
              }}
              onDragEnter={() => handleDragEnter(agent.sessionId)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDragEnd={() => {
                setDraggingId(null);
                onReorder(displayAgentsRef.current.map((item) => item.sessionId));
                setOrderOverride(null);
              }}
            >
              <div className="chat-row-avatar">
                <Avatar avatar={agent.avatar} size={42} alt={agent.name} />
                {agent.unread > 0 ? (
                  <span className="unread-badge">{agent.unread > 99 ? "99+" : agent.unread}</span>
                ) : null}
              </div>
              <div className="chat-row-body">
                <div className="chat-row-top">
                  <span className="chat-row-name">
                    {agent.pinned ? <Pin size={11} className="pin-icon" aria-label="Pinned" /> : null}
                    {agent.name}
                  </span>
                  <span className="chat-row-time">
                    {last ? formatListTime(last.createdAt) : ""}
                  </span>
                </div>
                {agent.task ? (
                  <span className="chat-row-task" title={agent.task}>
                    {agent.task}
                  </span>
                ) : null}
                <div className="chat-row-bottom">
                  <span className="chat-row-preview">
                    {last?.file ? <Paperclip size={11} className="inline-icon" /> : null}
                    {preview}
                  </span>
                  <button
                    type="button"
                    className="row-more"
                    aria-label={`Actions for ${agent.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      onSelect(agent);
                      openMenu(agent, rect.right, rect.bottom + 4);
                    }}
                  >
                    <Ellipsis size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: menu.agent.pinned ? "Unpin" : "Pin",
              icon: menu.agent.pinned ? <PinOff size={14} /> : <Pin size={14} />,
              onSelect: () => onTogglePin(menu.agent),
            },
            {
              label: "Mark as unread",
              icon: <Mail size={14} />,
              onSelect: () => onMarkUnread(menu.agent),
            },
          ]}
        />
      ) : null}
    </section>
  );
}