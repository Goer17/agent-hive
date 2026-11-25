import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { ZodError } from "zod";
import { WEB_DIST_DIR } from "./config.js";
import { HttpError } from "./lib/http.js";
import { authRouter } from "./routes/auth.routes.js";
import { agentsRouter } from "./routes/agents.routes.js";
import { agentApiRouter } from "./routes/agentApi.routes.js";
import { topologyRouter } from "./routes/topology.routes.js";
import { categoriesRouter } from "./routes/categories.routes.js";
import { tokensRouter } from "./routes/tokens.routes.js";
import { settingsRouter } from "./routes/settings.routes.js";
import { filesRouter } from "./routes/files.routes.js";
import { eventsRouter } from "./routes/events.routes.js";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use(express.json({ limit: "1mb" }));

  app.use((request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    if (request.path.startsWith("/api")) {
      response.setHeader("Cache-Control", "no-store");
    }
    next();
  });

  app.use((request, response, next) => {
    const startedAt = Date.now();
    response.on("finish", () => {
      if (request.path.startsWith("/api")) {
        console.log(
          `${request.method} ${request.path} ${response.statusCode} ${Date.now() - startedAt}ms`,
        );
      }
    });
    next();
  });

  app.use("/api/auth", authRouter);
  app.use("/api/agents", agentsRouter);
  app.use("/api/topology", topologyRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/tokens", tokensRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/files", filesRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/agent", agentApiRouter);

  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "Not found." });
  });

  if (fs.existsSync(WEB_DIST_DIR)) {
    app.use(express.static(WEB_DIST_DIR, { index: false, maxAge: "1h" }));
    app.use((request, response, next) => {
      if (request.method !== "GET" || request.path.startsWith("/api")) {
        next();
        return;
      }
      response.sendFile(path.join(WEB_DIST_DIR, "index.html"));
    });
  }

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof ZodError) {
        const first = error.issues[0];
        response.status(400).json({ error: first?.message ?? "Invalid request." });
        return;
      }

      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          response.status(413).json({ error: "File exceeds the 200 MB limit." });
          return;
        }
        response.status(400).json({ error: error.message });
        return;
      }

      if (error instanceof HttpError) {
        response.status(error.status).json({ error: error.message });
        return;
      }

      console.error(error);
      response.status(500).json({ error: "Internal server error." });
    },
  );

  return app;
}