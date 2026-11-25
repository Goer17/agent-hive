import { Router } from "express";
import { z } from "zod";
import { requireBrowserAuth } from "../middleware/auth.js";
import { serverOrigin } from "../lib/http.js";
import {
  sendTestEmail,
  toPublicNotificationSettings,
  updateEmailSettings,
} from "../services/email.service.js";
import { store } from "../store/store.js";

export const settingsRouter = Router();
settingsRouter.use(requireBrowserAuth);

const uploadSettingsSchema = z.object({
  maxFileSizeMb: z.number().int().min(1).max(1024),
});

settingsRouter.get("/uploads", (_request, response) => {
  response.json({ settings: store.data.settings.uploads });
});

settingsRouter.put("/uploads", (request, response) => {
  const body = uploadSettingsSchema.parse(request.body);
  store.data.settings.uploads = body;
  store.save();
  response.json({ settings: store.data.settings.uploads });
});

const emailSettingsSchema = z.object({
  enabled: z.boolean(),
  email: z.string().trim().max(320).default(""),
  smtpHost: z.string().trim().max(255).default(""),
  smtpPort: z.number().int().min(1).max(65_535).default(587),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().trim().max(255).default(""),
  smtpPassword: z.string().max(500).optional(),
  clearPassword: z.boolean().optional(),
  smtpFrom: z.string().trim().max(320).default(""),
  serverUrl: z.string().trim().max(500).default(""),
});

settingsRouter.get("/email", (request, response) => {
  // Auto-detect the server address from the address the browser is using.
  const origin = serverOrigin(request);
  const settings = store.data.settings.notifications;
  if (settings.serverUrl !== origin) {
    settings.serverUrl = origin;
    store.save();
  }
  response.json({ settings: toPublicNotificationSettings(settings) });
});

settingsRouter.put("/email", (request, response) => {
  const body = emailSettingsSchema.parse(request.body);
  // The UI no longer asks for this: use the address the browser is on.
  const settings = updateEmailSettings({ ...body, serverUrl: serverOrigin(request) });
  response.json({ settings: toPublicNotificationSettings(settings) });
});

settingsRouter.post("/email/test", async (request, response) => {
  const body = emailSettingsSchema.parse(request.body);
  await sendTestEmail({ ...body, serverUrl: serverOrigin(request) }, serverOrigin(request));
  response.json({ sent: true });
});