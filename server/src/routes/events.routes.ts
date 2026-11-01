import { Router } from "express";
import { requireBrowserAuth } from "../middleware/auth.js";
import { events } from "../lib/events.js";

export const eventsRouter = Router();

eventsRouter.get("/", requireBrowserAuth, (request, response) => {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.write(": connected\n\n");
  events.addClient(response);
  request.on("close", () => {
    response.end();
  });
});