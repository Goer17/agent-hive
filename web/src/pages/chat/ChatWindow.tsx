import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ChevronUp,
  File as FileIcon,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import type { Agent, Message } from "../../types";
import { Avatar } from "../../components/Avatar";
import { HiveMark } from "../../components/HiveMark";
import { formatFileSize } from "../../lib/format";
import { toast } from "../../lib/toast";
import { AgentInfoPopover } from "./AgentInfoPopover";
import { MessageBubble } from "./MessageBubble";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface ChatWindowProps {
  agent: Agent | null;
  messages: Message[];
  loading: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  sending: boolean;
  onBack: () => void;
  onSend: (text: string, file: File | null) => Promise<void>;
  onLoadMore: () => Promise<void>;
  onUpdated: (agent: Agent) => void;
  onDeleted: (agent: Agent) => void;
}

export function ChatWindow({
  agent,
  messages,
  loading,
  loadingOlder,
  hasMore,
  sending,
  onBack,
  onSend,
  onLoadMore,
  onUpdated,
  onDeleted,
}: ChatWindowProps): React.JSX.Element {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [localSending, setLocalSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isNearBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const anchorRef = useRef<{ height: number; firstId: string } | null>(null);
  const forceScrollRef = useRef(false);
  const wasLoadingOlderRef = useRef(false);

  const busy = sending || localSending;

  useEffect(() => {
    if (!agent) setInfoOpen(false);
  }, [agent]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(140, Math.max(38, textarea.scrollHeight))}px`;
  }, [text]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const anchor = anchorRef.current;
    if (anchor && messages[0]?.id !== anchor.firstId) {
      element.scrollTop += element.scrollHeight - anchor.height;
      anchorRef.current = null;
      prevCountRef.current = messages.length;
      return;
    }

    const firstLoad = prevCountRef.current === 0 && messages.length > 0;
    if (firstLoad || forceScrollRef.current || (messages.length > prevCountRef.current && isNearBottomRef.current)) {
      element.scrollTop = element.scrollHeight;
      forceScrollRef.current = false;
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (wasLoadingOlderRef.current && !loadingOlder) {
      if (anchorRef.current && messages[0]?.id === anchorRef.current.firstId) {
        anchorRef.current = null;
      }
    }
    wasLoadingOlderRef.current = loadingOlder;
  }, [loadingOlder, messages]);

  async function submit(): Promise<void> {
    if (!agent || busy) return;
    const trimmed = text.trim();
    if (!trimmed && !file) return;
    setLocalSending(true);
    forceScrollRef.current = true;
    try {
      await onSend(trimmed, file);
      setText("");
      setFile(null);
      if (textareaRef.current) textareaRef.current.style.height = "38px";
      textareaRef.current?.focus();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setLocalSending(false);
    }
  }

  async function loadMore(): Promise<void> {
    const element = scrollRef.current;
    if (!element || messages.length === 0) return;
    anchorRef.current = { height: element.scrollHeight, firstId: messages[0]?.id ?? "" };
    try {
      await onLoadMore();
    } catch {
      anchorRef.current = null;
    }
  }

  function handleMediaLoad(): void {
    if (!isNearBottomRef.current) return;
    window.requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }

  function chooseFile(selected: File | null): void {
    if (!selected) return;
    if (selected.size > MAX_FILE_SIZE) {
      toast("File exceeds the 50 MB limit.");
      return;
    }
    setFile(selected);
  }

  if (!agent) {
    return (
      <section className="chat-window chat-window-empty" aria-label="Conversation">
        <div className="chat-empty">
          <HiveMark size={34} />
          <p>Select a conversation.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="chat-window" aria-label={`Conversation with ${agent.name}`}>
      <header className="chat-header">
        <button
          type="button"
          className="icon-button mobile-back"
          aria-label="Back to conversations"
          onClick={onBack}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          className="header-avatar"
          onClick={() => setInfoOpen(true)}
          title={`${agent.name} info`}
          aria-label={`Show ${agent.name} info`}
        >
          <Avatar avatar={agent.avatar} size={40} alt={agent.name} />
        </button>
        <div className="chat-header-title">
          <h2>{agent.name}</h2>
          <p>{agent.task}</p>
        </div>
      </header>

      <div
        className="message-scroll"
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
          isNearBottomRef.current = distance < 140;
        }}
      >
        <div className="message-flow">
          {hasMore ? (
            <button
              type="button"
              className="load-more"
              onClick={() => void loadMore()}
              disabled={loadingOlder}
            >
              {loadingOlder ? <Loader2 size={13} className="spin" /> : <ChevronUp size={13} />}
              Load earlier messages
            </button>
          ) : null}
          {loading ? (
            <div className="chat-loading">
              <Loader2 size={18} className="spin" />
            </div>
          ) : null}
          {!loading && messages.length === 0 ? (
            <p className="empty-note centered">No messages yet.</p>
          ) : null}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              agent={agent}
              onShowAgentInfo={() => setInfoOpen(true)}
              onMediaLoad={handleMediaLoad}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <footer className="composer">
        {file ? (
          <div className="composer-file">
            <FileIcon size={14} />
            <span className="composer-file-name">{file.name}</span>
            <span className="composer-file-size">{formatFileSize(file.size)}</span>
            <button
              type="button"
              className="icon-button icon-button-small"
              aria-label="Remove file"
              onClick={() => setFile(null)}
            >
              <X size={13} />
            </button>
          </div>
        ) : null}
        <div className="composer-row">
          <input
            ref={fileInputRef}
            type="file"
            className="visually-hidden"
            onChange={(event) => {
              chooseFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="icon-button composer-attach"
            aria-label="Attach file"
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={18} />
          </button>
          <textarea
            ref={textareaRef}
            className="composer-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void submit();
              }
            }}
            rows={1}
            aria-label="Message"
          />
          <button
            type="button"
            className="send-button"
            aria-label="Send"
            title="Send"
            disabled={busy || (!text.trim() && !file)}
            onClick={() => void submit()}
          >
            {busy ? <Loader2 size={17} className="spin" /> : <Send size={17} />}
          </button>
        </div>
      </footer>

      {infoOpen ? (
        <AgentInfoPopover
          agent={agent}
          onClose={() => setInfoOpen(false)}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
        />
      ) : null}
    </section>
  );
}