import type { Agent, Message } from "../../types";
import { Avatar } from "../../components/Avatar";
import { FileAttachment } from "../../components/FileAttachment";
import { HiveMark } from "../../components/HiveMark";
import { formatTimestamp } from "../../lib/format";

interface MessageBubbleProps {
  message: Message;
  agent: Agent;
  onShowAgentInfo: () => void;
  onMediaLoad: () => void;
}

export function MessageBubble({
  message,
  agent,
  onShowAgentInfo,
  onMediaLoad,
}: MessageBubbleProps): React.JSX.Element {
  const isAgent = message.from.role === "agent";

  return (
    <article className={`message-row${isAgent ? " from-agent" : " from-user"}`}>
      {isAgent ? (
        <button
          type="button"
          className="message-avatar"
          onClick={onShowAgentInfo}
          title={`${agent.name} info`}
          aria-label={`Show ${agent.name} info`}
        >
          <Avatar avatar={agent.avatar} size={30} alt={agent.name} />
        </button>
      ) : null}
      <div className="message-stack">
        <div className="message-meta">
          <span className="message-author">{isAgent ? message.from.name : "user"}</span>
          <time dateTime={message.createdAt}>{formatTimestamp(message.createdAt)}</time>
          {!isAgent ? (
            <span
              className={`message-read${message.read ? " is-read" : ""}`}
              title={message.read ? "Read by the agent" : "Not read by the agent"}
            >
              {message.read ? "Read" : "Unread"}
            </span>
          ) : null}
        </div>
        <div className={`message-bubble${message.file ? " has-file" : ""}`}>
          {message.file ? <FileAttachment file={message.file} onMediaLoad={onMediaLoad} /> : null}
          {message.text ? <p className="message-text">{message.text}</p> : null}
        </div>
      </div>
      {!isAgent ? (
        <div className="user-avatar" aria-hidden="true">
          <HiveMark size={19} />
        </div>
      ) : null}
    </article>
  );
}