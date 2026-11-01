export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return [
    String(date.getFullYear()).slice(2),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds()),
  ].join("");
}

export function formatListTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");
  if (date.toDateString() === now.toDateString()) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  return `${String(date.getFullYear()).slice(2)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export function previewText(text: string, limit = 72): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
}

export function avatarUrl(index: number): string {
  const safe = Math.min(24, Math.max(1, Math.round(index)));
  return `/avatars/avatar-${String(safe).padStart(2, "0")}.svg`;
}

export function maskToken(prefix: string): string {
  return `token ${prefix}-***`;
}

export function fileExtension(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

export function fileKind(name: string): "image" | "video" | "audio" | "archive" | "file" {
  const extension = fileExtension(name);
  if (["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(extension)) return "image";
  if (["mp4", "webm", "mov", "ogv"].includes(extension)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "flac"].includes(extension)) return "audio";
  if (["zip", "tar", "gz", "rar", "7z"].includes(extension)) return "archive";
  return "file";
}

export function pairKey(first: string, second: string): string {
  return [first, second].sort().join(":");
}