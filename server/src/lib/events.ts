import type { Response } from "express";

export interface ServerEvent {
  type: "agents" | "topology" | "message" | "tokens";
  data: Record<string, unknown>;
}

class EventBus {
  private readonly clients = new Set<Response>();
  private heartbeat: NodeJS.Timeout | null = null;

  addClient(response: Response): void {
    this.clients.add(response);
    this.ensureHeartbeat();
    response.on("close", () => {
      this.clients.delete(response);
      if (this.clients.size === 0) this.stopHeartbeat();
    });
  }

  emit(event: ServerEvent): void {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  private ensureHeartbeat(): void {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      for (const client of this.clients) {
        try {
          client.write(": ping\n\n");
        } catch {
          this.clients.delete(client);
        }
      }
    }, 20_000);
    this.heartbeat.unref();
  }

  private stopHeartbeat(): void {
    if (!this.heartbeat) return;
    clearInterval(this.heartbeat);
    this.heartbeat = null;
  }
}

export const events = new EventBus();