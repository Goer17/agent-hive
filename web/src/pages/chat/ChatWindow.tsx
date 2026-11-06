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
import { HarnessIcon } from "../../components/HarnessIcon";
import { MessageBubble } from "./MessageBubble";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_TOTAL_FILE_SIZE = 100 * 1024 * 1024;

function ComposerFile({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}): React.JSX.Element {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="composer-file">
      {preview ? (
        <img className="composer-file-thumb" src={preview} alt={file.name} />
      ) : (
        <FileIcon size={14} />
      )}
      <span className="composer-file-name">{file.name}</span>
      <span className="composer-file-size">{formatFileSize(file.size)}</span>
      <button
        type="button"
        className="icon-button icon-button-small"
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
      >
        <X size={13} />
      </button>
    </div>
  );
}

interface ChatWindowProps {
  agent: Agent | null;
  messages: Message[];
  loading: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  sending: boolean;
  onBack: () => void;
  onSend: (text: string, files: File[]) => Promise<void>;
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
  const [files, setFiles] = useState<File[]>([]);
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
    if (!trimmed && files.length === 0) return;
    setLocalSending(true);
    forceScrollRef.current = true;
    try {
      await onSend(trimmed, files);
      setText("");
      setFiles([]);
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

  function addFiles(selected: File[]): void {
    const valid = selected.filter((candidate) => candidate.size <= MAX_FILE_SIZE);
    if (valid.length < selected.length) toast("Some files exceed the 50 MB limit.");
    if (valid.length === 0) return;

    const next = [...files, ...valid];
    if (next.length > MAX_FILES) {
      toast(`A message supports at most ${MAX_FILES} files.`);
      return;
    }
    if (next.reduce((total, candidate) => total + candidate.size, 0) > MAX_TOTAL_FILE_SIZE) {
      toast("Attachments must total at most 100 MB.");
      return;
    }
    setFiles(next);
  }

  function removeFile(index: number): void {
    setFiles((current) => current.filter((_, position) => position !== index));
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>): void {
    const data = event.clipboardData;
    if (!data) return;

    const images: File[] = [];
    for (const item of Array.from(data.items ?? [])) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
      const pasted = item.getAsFile();
      if (pasted) images.push(pasted);
    }
    if (images.length === 0) {
      for (const candidate of Array.from(data.files ?? [])) {
        if (candidate.type.startsWith("image/")) images.push(candidate);
      }
    }

    const image = images[0];
    if (!image) return;

    // An image was pasted: attach it instead of inserting its name as text.
    event.preventDefault();
    const subtype = image.type === "image/jpeg" ? "jpg" : image.type.split("/")[1] || "png";
    const extension = subtype.replace(/[^a-z0-9]/gi, "") || "png";
    addFiles([new File([image], `pasted-image-${Date.now()}.${extension}`, { type: image.type })]);
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
          <p className="chat-header-task">
            <HarnessIcon harness={agent.harness} size={11} />
            <span>{agent.task}</span>
          </p>
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
        {files.length > 0 ? (
          <div className="composer-files">
            {files.map((item, index) => (
              <ComposerFile
                key={`${item.name}-${item.lastModified}-${index}`}
                file={item}
                onRemove={() => removeFile(index)}
              />
            ))}
          </div>
        ) : null}
        <div className="composer-row">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="visually-hidden"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="icon-button composer-attach"
            aria-label="Attach files"
            title="Attach files (paste images with Ctrl+V)"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={18} />
          </button>
          <textarea
            ref={textareaRef}
            className="composer-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onPaste={handlePaste}
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
            disabled={busy || (!text.trim() && files.length === 0)}
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