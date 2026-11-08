import { HOST, PORT, localAddresses } from "./config.js";
import { createApp } from "./app.js";
import { ensureAccessToken } from "./services/auth.service.js";
import { registerEmailNotificationHandler } from "./services/email.service.js";

const accessToken = ensureAccessToken();
registerEmailNotificationHandler();
const app = createApp();

const server = app.listen(PORT, HOST, () => {
  const lines = [
    "",
    "  agent-hive",
    `  local    http://localhost:${PORT}`,
    ...localAddresses().map((address) => `  network  http://${address}:${PORT}`),
    `  token    ${accessToken}`,
    "",
  ];
  console.log(lines.join("\n"));
});

server.on("error", (error) => {
  console.error(`Unable to start agent-hive server: ${error.message}`);
  process.exitCode = 1;
});

function shutdown(): void {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);