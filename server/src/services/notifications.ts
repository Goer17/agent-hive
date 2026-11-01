import type { AgentRecord, MessageRecord } from "../types.js";

export interface UserMessageNotification {
  agent: AgentRecord;
  message: MessageRecord;
}

type NotificationHandler = (event: UserMessageNotification) => void | Promise<void>;

const handlers = new Set<NotificationHandler>();

/**
 * Register a side-channel notifier (for example, email) for messages sent by
 * agents to the user. Handlers are isolated: one failing handler never blocks
 * message delivery.
 */
export function registerNotificationHandler(handler: NotificationHandler): void {
  handlers.add(handler);
}

export async function notifyUserMessage(event: UserMessageNotification): Promise<void> {
  if (handlers.size === 0) return;
  const results = await Promise.allSettled(
    [...handlers].map(async (handler) => {
      await handler(event);
    }),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Notification handler failed:", result.reason);
    }
  }
}