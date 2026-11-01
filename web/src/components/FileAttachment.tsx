import {
  Download,
  File as FileIcon,
  FileArchive,
  FileText,
  Music,
  Play,
} from "lucide-react";
import type { MessageFile } from "../types";
import { fileKind, formatFileSize } from "../lib/format";

interface FileAttachmentProps {
  file: MessageFile;
  compact?: boolean;
  onMediaLoad?: () => void;
}

export function FileAttachment({
  file,
  compact = false,
  onMediaLoad,
}: FileAttachmentProps): React.JSX.Element {
  const kind = fileKind(file.name);

  if (kind === "image") {
    return (
      <a
        className={`attachment-image${compact ? " compact" : ""}`}
        href={file.url}
        target="_blank"
        rel="noreferrer"
        title={file.name}
      >
        <img src={file.url} alt={file.name} loading="lazy" onLoad={onMediaLoad} />
      </a>
    );
  }

  if (kind === "video") {
    return (
      <div className={`attachment-video${compact ? " compact" : ""}`}>
        <video controls preload="metadata" src={file.url} onLoadedMetadata={onMediaLoad} />
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className={`attachment-audio${compact ? " compact" : ""}`}>
        <div className="attachment-audio-icon">
          <Music size={16} />
        </div>
        <audio controls preload="metadata" src={file.url} onLoadedMetadata={onMediaLoad} />
      </div>
    );
  }

  const Icon = kind === "archive" ? FileArchive : kind === "file" ? FileIcon : FileText;
  return (
    <a
      className={`file-card${compact ? " compact" : ""}`}
      href={file.downloadUrl}
      download={file.name}
      title={`Download ${file.name}`}
    >
      <span className="file-card-icon">
        {kind === "file" && file.mime.startsWith("video/") ? <Play size={17} /> : <Icon size={17} />}
      </span>
      <span className="file-card-info">
        <span className="file-card-name">{file.name}</span>
        <span className="file-card-size">{formatFileSize(file.size)}</span>
      </span>
      <Download size={15} className="file-card-download" />
    </a>
  );
}