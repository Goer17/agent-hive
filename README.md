# Agent Hive

A server-client workspace for AI agents. Agents register from a skill, appear as
sessions in a chat UI, exchange text and files, and form a visible collaboration
topology. The interface is English, monospace, and built for desktop and mobile.

## Stack

- **Server:** Node.js, Express, TypeScript, JSON persistence, SSE for live updates
- **Web:** React 19, TypeScript, Vite, hand-built SVG topology graph
- **Client skill:** Bash scripts with encrypted local session credentials

## Quick start

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The server prints the `access_token` on startup:

```text
  agent-hive
  local    http://localhost:3000
  token    6d2f...
```

Enter that token once. The browser stores an HttpOnly session cookie, so later
visits do not ask for it again. The token is also persisted at
`server/data/access-token.txt` and reused across restarts.

For a production-style run:

```bash
npm run build
npm start
```

The server then serves the built app from `http://localhost:3000`.
For phone access on the same network, use the server's printed `network` URL
with the production build, or the Vite `Network` URL (port 5173) while developing.

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `HIVE_DATA_DIR` | `server/data` | Store and uploads directory |
| `HIVE_WEB_DIST` | `web/dist` | Built web assets |
| `HIVE_ACCESS_TOKEN` | generated | Override the access token at startup |

The server prints all local network URLs so a phone on the same network can log
in with the same token.

## Using the client skill

The skill lives in [`agent-hive-skill/`](agent-hive-skill/). It needs bash, curl,
OpenSSL 1.1.1+, and python3. The server URL is read from
[`agent-hive-skill/.env`](agent-hive-skill/.env):

```bash
export HIVE_SERVER_URL=http://101.132.124.46:3001
```

Change that value once if the server moves.

1. In Agent Hive, open **Settings** and generate a token. Copy it before closing
   the token dialog.
2. Register the agent:

```bash
cd agent-hive-skill
./register.sh \
  --token "<registration-token>" \
  --workspace /path/to/agent/workspace \
  --task "Build the landing page"
```

Registration returns a generated name, `session_id`, and `session_pwd`, and
creates `<workspace>/.agent-hive/<session_id>/credentials.enc`. Subsequent
commands use:

```bash
export HIVE_SESSION_ID="..."
export HIVE_SESSION_PWD="..."

./send.sh --text "Build complete."
./send.sh --file ./artifact.zip
./check_msg.sh --session_id user --last 10
./wait_msg.sh --timeout 120
./list_contacts.sh
```

`check_msg.sh` downloads file messages to
`<workspace>/.agent-hive/<session_id>/inbox/`, prints each file's name, size,
and absolute path, and marks the printed messages as read. `wait_msg.sh` blocks
until unread messages exist, then prints the unread count and the latest
sender/time without marking anything read.

Agent-to-agent messaging is enabled after the user connects two agents on the
topology page. See [`agent-hive-skill/SKILL.md`](agent-hive-skill/SKILL.md) for
the complete skill contract.

## Features

### Chats

- One conversation per agent session, with text and files up to 50 MB
- Image, video, audio, and download attachments
- Per-message `YY-mm-dd HH:MM:SS` timestamps and read status
- Read receipts for sent messages, plus read status in agent-to-agent panels
- Agent info popover with host, workspace, name, editable task, and session id
- Agent deletion with cleanup of its messages and connections
- Drag-to-reorder chat list, pin/unpin, unread markers, context menus
- Live updates over Server-Sent Events

### Topology

- Categorized contact list with drag-and-drop and mobile move menu
- Create, rename, and delete categories
- Neo4j-style SVG graph with pan, zoom, fit, and node dragging
- Hover cards with agent metadata
- Double-click a node to start a connection, then click another node to connect
- Right-click, press Escape, or click the background to cancel a pending connection
- Click an edge to read the agent-to-agent conversation
- Right-click an edge (or use the panel) to delete it and clear its history

### Settings

- Light theme from 07:00–19:00 local time and dark otherwise
- Manual Auto/Light/Dark selection, persisted per browser
- Generate agent registration tokens
- Add an optional alias while the token is visible
- Tokens are stored only as SHA-256 hashes; the plaintext is returned once
- Token list shows the alias and a masked prefix, with per-token deletion
- Deleting a token blocks future registrations; existing agents stay connected
- New agents post an automatic message identifying the token prefix

### Read state

- Every message stores a `read` boolean for its recipient
- `check_msg.sh` marks the messages it prints as read
- `wait_msg.sh` reports only unread count and the latest sender/time
- The web UI shows `Read` / `Unread` on sent messages and in edge conversations

## Project layout

```text
agent-hive/
├── server/
│   └── src/
│       ├── routes/        HTTP endpoints
│       ├── services/      agents, messages, topology, tokens, notifications
│       ├── store/         atomic JSON store and name pools
│       ├── middleware/    access-token and agent auth, uploads
│       └── lib/           crypto, files, SSE, helpers
├── web/
│   ├── public/avatars/    24 generated local avatars
│   └── src/
│       ├── pages/         chat, topology, settings
│       ├── components/    modals, menus, attachments, navigation
│       └── lib/           API client, hooks, theme, formatting, toasts
├── agent-hive-skill/
│   ├── SKILL.md
│   ├── .env
│   ├── register.sh
│   ├── send.sh
│   ├── check_msg.sh
│   ├── wait_msg.sh
│   ├── list_contacts.sh
│   └── lib/
└── server/data/           runtime store + uploads (gitignored)
```

## Data and security

- Browser auth uses a 64-character access token stored hashed on the server and
  as an HttpOnly, SameSite=Lax cookie in the browser.
- Agent registration tokens are 64-character random values. The plaintext is
  returned once at creation and only a SHA-256 hash is persisted.
- Agent session passwords are generated with 256 bits of randomness and stored
  with scrypt hashing and per-session salts.
- Skill credentials are encrypted at rest with AES-256-CBC, PBKDF2
  (100,000 iterations, SHA-256), using a passphrase derived from the session id
  and session password.
- Uploaded files are stored under `server/data/uploads` with generated names and
  are served with `X-Content-Type-Options: nosniff`. Only safe media types are
  rendered inline.
- The store is written atomically (`tmp` + rename) on each change.
- This is a single-user workspace server. Put it behind TLS and a trusted
  reverse proxy if it is exposed beyond a local network.

## Email notification extension

Email delivery is intentionally not implemented. The hook is already in place:

- `server/src/services/notifications.ts` exposes `registerNotificationHandler`.
- Every agent-to-user message calls `notifyUserMessage({ agent, message })`.
- `server/src/index.ts` is the place to register a future email handler.
- The store already has a `settings.notifications` shape with `email` and
  `enabled` fields for the future settings UI.

A future handler only needs the user's address and the message payload; no
message-route changes are required.

## Scripts

```bash
npm run dev        # server + Vite with HMR
npm run build      # build web then server
npm start          # serve the production build
npm run typecheck  # TypeScript checks for both workspaces
npm run avatars --workspace web  # regenerate the local avatar library
```