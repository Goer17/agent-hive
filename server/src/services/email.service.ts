import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { PORT } from "../config.js";
import { badRequest } from "../lib/http.js";
import { store } from "../store/store.js";
import type {
  AgentRecord,
  MessageRecord,
  NotificationSettings,
  PublicNotificationSettings,
} from "../types.js";
import { registerNotificationHandler } from "./notifications.js";

const HARNESS_LABELS: Record<string, string> = {
  codex: "Codex",
  "claude-code": "Claude Code",
  pi: "pi",
  "kimi-code": "Kimi Code",
  "z-code": "Z Code",
  hermes: "Hermes",
  dsh: "DSH",
};

const DEFAULT_SERVER_URL = `http://localhost:${PORT}`;

export interface EmailSettingsUpdate {
  enabled: boolean;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword?: string;
  clearPassword?: boolean;
  smtpFrom: string;
  serverUrl: string;
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function configured(settings: NotificationSettings): boolean {
  return Boolean(settings.email && settings.smtpHost && settings.smtpFrom);
}

function normalizedServerUrl(value: string | null | undefined): string | null {
  const trimmed = trimmedOrNull(value);
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    badRequest("Server URL must start with http:// or https://.");
  }
  return trimmed.replace(/\/+$/, "");
}

function harnessLabel(harness: string | null): string {
  const value = (harness ?? "").trim();
  if (!value) return "unknown";
  return HARNESS_LABELS[value.toLowerCase()] ?? value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatEmailTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(" ");
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function baseUrl(settings: NotificationSettings, fallbackServerUrl?: string): string {
  const setting = settings.serverUrl?.trim().replace(/\/+$/, "");
  if (setting) return setting;
  const environment = process.env.HIVE_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (environment) return environment;
  const fallback = fallbackServerUrl?.trim().replace(/\/+$/, "");
  return fallback || DEFAULT_SERVER_URL;
}

export function chatUrl(
  settings: NotificationSettings,
  agentId: string,
  fallbackServerUrl?: string,
): string {
  return `${baseUrl(settings, fallbackServerUrl)}/#/chat?agent=${encodeURIComponent(agentId)}`;
}

export function toPublicNotificationSettings(
  settings: NotificationSettings,
): PublicNotificationSettings {
  return {
    enabled: settings.enabled,
    email: settings.email,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser,
    smtpPasswordSet: Boolean(settings.smtpPassword),
    smtpFrom: settings.smtpFrom,
    serverUrl: settings.serverUrl,
    configured: configured(settings),
  };
}

function mergeSettings(update: EmailSettingsUpdate): NotificationSettings {
  const current = store.data.settings.notifications;
  const email = trimmedOrNull(update.email);
  if (email && !isEmailAddress(email)) {
    badRequest("Enter a valid recipient email address.");
  }
  const smtpFrom = trimmedOrNull(update.smtpFrom);
  if (smtpFrom && !isEmailAddress(smtpFrom)) {
    badRequest("Enter a valid sender email address.");
  }

  const next: NotificationSettings = {
    enabled: update.enabled,
    email,
    smtpHost: trimmedOrNull(update.smtpHost),
    smtpPort: update.smtpPort,
    smtpSecure: update.smtpSecure,
    smtpUser: trimmedOrNull(update.smtpUser),
    smtpPassword: current.smtpPassword,
    smtpFrom,
    serverUrl: normalizedServerUrl(update.serverUrl),
  };

  if (update.clearPassword) {
    next.smtpPassword = null;
  } else if (update.smtpPassword !== undefined) {
    next.smtpPassword = update.smtpPassword.length > 0 ? update.smtpPassword : null;
  }

  if (next.enabled && !configured(next)) {
    badRequest("Set the recipient, SMTP host, and sender address before enabling email notifications.");
  }

  return next;
}

export function updateEmailSettings(update: EmailSettingsUpdate): NotificationSettings {
  const next = mergeSettings(update);
  store.data.settings.notifications = next;
  store.save();
  return next;
}

let transportCache: { key: string; transport: Transporter } | null = null;

function transportFor(settings: NotificationSettings): Transporter {
  const key = [
    settings.smtpHost,
    settings.smtpPort,
    settings.smtpSecure,
    settings.smtpUser,
    settings.smtpPassword,
  ].join("\u0000");

  if (transportCache?.key === key) return transportCache.transport;

  const transport = nodemailer.createTransport({
    host: settings.smtpHost ?? undefined,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: settings.smtpUser
      ? { user: settings.smtpUser, pass: settings.smtpPassword ?? "" }
      : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  transportCache = { key, transport };
  return transport;
}

interface MailContent {
  subject: string;
  text: string;
  html: string;
}

async function sendMail(settings: NotificationSettings, content: MailContent): Promise<void> {
  const from = settings.smtpFrom ?? settings.smtpUser;
  if (!from || !settings.email) {
    badRequest("Email notifications are not fully configured.");
  }
  await transportFor(settings).sendMail({
    from,
    to: settings.email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

function messagePreview(message: MessageRecord): string {
  const text = message.text.replace(/\s+/g, " ").trim();
  if (text) return text.length > 90 ? `${text.slice(0, 87)}...` : text;
  const names = message.files.map((file) => file.name).join(", ");
  return names || "New message";
}

function messageContent(
  settings: NotificationSettings,
  agent: AgentRecord,
  message: MessageRecord,
  fallbackServerUrl?: string,
): MailContent {
  const time = formatEmailTime(message.createdAt);
  const name = `${agent.name} (${harnessLabel(agent.harness)})`;
  const from = `${agent.host}:${agent.workspace}`;
  const base = baseUrl(settings, fallbackServerUrl);
  const url = `${base}/#/chat?agent=${encodeURIComponent(agent.sessionId)}`;
  const content = message.text || "(no text)";
  const files = message.files.map((file) => ({
    name: file.name,
    size: formatFileSize(file.size),
    url: `${base}/api/files/${encodeURIComponent(file.id)}?download=1`,
  }));

  const textLines = [
    `time: ${time}`,
    `name: ${name}`,
    `task: ${agent.task}`,
    `from: ${from}`,
    "",
    "---",
    "",
    content,
  ];
  if (files.length > 0) {
    textLines.push("", "attachments:", ...files.map((file) => `- ${file.name} (${file.size}) ${file.url}`));
  }
  textLines.push("", `hive_server_url: ${url}`);

  const attachmentHtml =
    files.length > 0
      ? `<div style="margin-top:18px;padding-top:14px;border-top:1px solid #e4e4e1;font-size:13px;color:#57534e;">
          <div style="margin-bottom:6px;color:#8a857d;font-size:11px;letter-spacing:.08em;text-transform:uppercase;">Attachments</div>
          ${files
            .map(
              (file) =>
                `<div style="margin:4px 0;"><a href="${escapeHtml(file.url)}" style="color:#9a6b16;">${escapeHtml(file.name)}</a> <span style="color:#8a857d;">(${escapeHtml(file.size)})</span></div>`,
            )
            .join("")}
        </div>`
      : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f3f0;color:#1c1917;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e1;border-radius:14px;overflow:hidden;">
      <div style="padding:22px 26px 18px;border-bottom:1px solid #ecebe7;background:#fbfaf8;">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a857d;">Agent Hive</div>
        <h1 style="margin:8px 0 0;font-size:18px;font-weight:600;letter-spacing:-.02em;">${escapeHtml(agent.name)}</h1>
      </div>
      <div style="padding:22px 26px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.65;">
          <tr><td style="width:92px;padding:2px 0;color:#8a857d;">time:</td><td style="padding:2px 0;font-variant-numeric:tabular-nums;">${escapeHtml(time)}</td></tr>
          <tr><td style="padding:2px 0;color:#8a857d;">name:</td><td style="padding:2px 0;">${escapeHtml(name)}</td></tr>
          <tr><td style="padding:2px 0;color:#8a857d;">task:</td><td style="padding:2px 0;">${escapeHtml(agent.task)}</td></tr>
          <tr><td style="padding:2px 0;color:#8a857d;">from:</td><td style="padding:2px 0;word-break:break-all;">${escapeHtml(from)}</td></tr>
        </table>
        <div style="margin:18px 0;border-top:1px solid #e4e4e1;"></div>
        <div style="white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.7;">${escapeHtml(content)}</div>
        ${attachmentHtml}
      </div>
      <div style="padding:16px 26px 22px;border-top:1px solid #ecebe7;background:#fbfaf8;font-size:12px;line-height:1.7;color:#8a857d;">
        <div><a href="${escapeHtml(url)}" style="color:#9a6b16;font-weight:500;">Open conversation in Agent Hive</a></div>
        <div style="word-break:break-all;">hive_server_url: ${escapeHtml(url)}</div>
      </div>
    </div>
  </body>
</html>`;

  return {
    subject: `[Agent Hive] ${agent.name}: ${messagePreview(message)}`,
    text: textLines.join("\n"),
    html,
  };
}

export async function sendTestEmail(
  update: EmailSettingsUpdate,
  requestServerUrl?: string,
): Promise<void> {
  const settings = mergeSettings(update);
  if (!configured(settings)) {
    badRequest("Set the recipient, SMTP host, and sender address before sending a test email.");
  }
  const url = settings.serverUrl ?? requestServerUrl ?? DEFAULT_SERVER_URL;
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f3f0;color:#1c1917;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e4e4e1;border-radius:14px;padding:26px;">
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a857d;">Agent Hive</div>
      <h1 style="margin:8px 0 12px;font-size:18px;font-weight:600;">Email notifications are working</h1>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#57534e;">This is a test message from your Agent Hive server. Agent replies to you will be delivered to this inbox.</p>
      <p style="margin:0;font-size:12px;color:#8a857d;">hive_server_url: <a href="${escapeHtml(url)}" style="color:#9a6b16;">${escapeHtml(url)}</a></p>
    </div>
  </body>
</html>`;

  await sendMail(settings, {
    subject: "[Agent Hive] Test email",
    text: "Email notifications are working.\n\nAgent replies to you will be delivered to this inbox.",
    html,
  });
}

async function deliverMessageEmail(
  settings: NotificationSettings,
  agent: AgentRecord,
  message: MessageRecord,
  fallbackServerUrl?: string,
): Promise<void> {
  await sendMail(settings, messageContent(settings, agent, message, fallbackServerUrl));
}

export function registerEmailNotificationHandler(): void {
  registerNotificationHandler(({ agent, message, serverUrl }) => {
    const settings = store.data.settings.notifications;
    if (!settings.enabled || !configured(settings)) return;
    if (agent.emailNotifications === false) return;

    // Do not make the agent wait on SMTP. Failures are logged and never affect
    // message delivery.
    void deliverMessageEmail(settings, agent, message, serverUrl).catch((error: unknown) => {
      console.error(
        `Email notification for agent ${agent.name} failed:`,
        error instanceof Error ? error.message : error,
      );
    });
  });
}