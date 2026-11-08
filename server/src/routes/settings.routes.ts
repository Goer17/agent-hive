import { Router } from "express";
import { z } from "zod";
import { requireBrowserAuth } from "../middleware/auth.js";
import {
  sendTestEmail,
  toPublicNotificationSettings,
  updateEmailSettings,
} from "../services/email.service.js";
import { store } from "../store/store.js";

export const settingsRouter = Router();
settingsRouter.use(requireBrowserAuth);

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

settingsRouter.get("/email", (_request, response) => {
  response.json({
    settings: toPublicNotificationSettings(store.data.settings.notifications),
  });
});

settingsRouter.put("/email", (request, response) => {
  const body = emailSettingsSchema.parse(request.body);
  const settings = updateEmailSettings(body);
  response.json({ settings: toPublicNotificationSettings(settings) });
});

settingsRouter.post("/email/test", async (request, response) => {
  const body = emailSettingsSchema.parse(request.body);
  await sendTestEmail(body);
  response.json({ sent: true });
});