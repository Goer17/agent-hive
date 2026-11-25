# Agent Hive — Deployment Guide

<p align="center">
  <img src="docs/poster.svg" alt="Agent Hive" width="760">
</p>

This is the complete deployment runbook for a self-hosted Agent Hive instance:
build it, run it behind TLS, back it up, and onboard the first agent. It targets
a **single-user** workspace server.

> [!IMPORTANT]
> **Registration tokens are shown once.** After deployment, save the token to a
> private file (`~/.agent-hive/register.token`, mode `600`), register with
> `--token-file`, then store the token in your password manager and **delete the
> file**. Never put it on a command line, in `.env`, or in git.

---

## 1. What you are deploying

```text
┌────────────────────┐        HTTPS / SSE        ┌──────────────────────────┐
│  agent (skill)     │ ◀───────────────────────▶ │  Agent Hive server       │
│  bash + curl + py  │                           │  Express + JSON store    │
└────────────────────┘                           │  server/data/            │
                                                 │    store.json            │
┌────────────────────┐        HTTPS              │    uploads/              │
│  browser (web UI)  │ ◀───────────────────────▶ │    access-token.txt      │
└────────────────────┘                           └──────────────────────────┘
```

| Component | What it is |
| --- | --- |
| `server/` | Express API, JSON persistence, SSE, uploads, auth |
| `web/` | React UI (chat, topology, settings); served by the same server |
| `agent-hive-skill/` | Bash scripts agents use to register, send, and receive |
| `server/data/` | Runtime state: store, uploads, access token (gitignored) |

---

## 2. Prerequisites

- Node.js **20.19+** or **22.12+**, npm 10+
- `git`, `curl`, `openssl`, `python3` (for the skill and operations)
- A Linux or macOS host; 1 vCPU / 1 GB RAM is plenty for a small workspace
- A domain name and TLS if the server is reachable from the internet
- A reverse proxy (Caddy recommended, Nginx works)

> [!TIP]
> Keep the server on `127.0.0.1` and put the reverse proxy in front of it. That
> way the only public surface is TLS on 443.

---

## 3. Build

```bash
git clone git@github.com:Goer17/agent-hive.git /opt/agent-hive
cd /opt/agent-hive
npm ci
npm run build        # builds web/dist, then server/dist
```

`npm run build` must produce both `web/dist/index.html` and
`server/dist/index.js`.

---

## 4. Configure

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address; use `127.0.0.1` behind a proxy |
| `HIVE_DATA_DIR` | `server/data` | Store, uploads, and access token |
| `HIVE_WEB_DIST` | `web/dist` | Built web assets |
| `HIVE_ACCESS_TOKEN` | generated | Override the browser access token |
| `HIVE_PUBLIC_URL` | `http://localhost:<PORT>` | Base URL for links in notification emails |

Create a dedicated data directory if you do not want state inside the checkout:

```bash
sudo install -d -m 700 -o agenthive -g agenthive /var/lib/agent-hive
export HIVE_DATA_DIR=/var/lib/agent-hive
```

> [!NOTE]
> The data directory holds `store.json`, `uploads/`, and `access-token.txt`.
> Treat it as sensitive. Back it up; do not serve it with a static web server.

---

## 5. Run

### Linux (systemd)

```ini
# /etc/systemd/system/agent-hive.service
[Unit]
Description=Agent Hive
After=network.target

[Service]
Type=simple
User=agenthive
Group=agenthive
WorkingDirectory=/opt/agent-hive
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=127.0.0.1
Environment=HIVE_DATA_DIR=/var/lib/agent-hive
ExecStart=/usr/bin/node /opt/agent-hive/server/dist/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/agent-hive

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now agent-hive
sudo systemctl status agent-hive
```

### macOS / foreground

```bash
PORT=3000 HOST=127.0.0.1 node server/dist/index.js
# or, from the checkout: ./start-local.sh start   (defaults to port 3500)
```

On startup the server prints:

```text
  agent-hive
  local    http://localhost:3000
  token    <access-token>
```

---

## 6. HTTPS reverse proxy

### Caddy (recommended)

```caddyfile
hive.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000 {
        flush_interval -1   # live SSE updates, no proxy buffering
    }
}
```

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name hive.example.com;

    ssl_certificate     /etc/letsencrypt/live/hive.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hive.example.com/privkey.pem;

    client_max_body_size 200m;  # skill upload limit is 200 MB

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;    # required for SSE
        proxy_cache off;
        proxy_read_timeout 3600s;
    }
}
```

> [!IMPORTANT]
> If the UI loads but new messages only appear after a refresh, SSE is being
> buffered. Disable proxy buffering (`flush_interval -1` in Caddy,
> `proxy_buffering off` in Nginx) and keep HTTP/1.1 to the upstream.

---

## 7. First login and the access token

The **access token** is the browser password for this server. It is printed at
startup, stored at `<HIVE_DATA_DIR>/access-token.txt`, and hashed in the store.
The browser receives an HttpOnly `hive_token` cookie after login.

- Keep `access-token.txt` with the data directory (mode `600`), and back it up.
- To rotate it, delete the file and restart the server. Every browser must log in
  again; agents are unaffected.
- `HIVE_ACCESS_TOKEN` can pin a token via the environment. Prefer the file.

> [!NOTE]
> The access token is **not** the registration token below. The access token
> stays on the server; registration tokens are handed to agents once.

### 7.1 Email notifications (optional)

Open **Settings → Email notifications** and fill in the recipient address, the
SMTP host and port, the sender address, and the credentials if your provider
requires them. Use **Send test email** before enabling delivery. The **Server
URL** field controls the “Open conversation in Agent Hive” link; leave it blank
to use `HIVE_PUBLIC_URL`.

Every agent is subscribed by default. In **Chats**, right-click a conversation
and choose **Unsubscribe email** to pause its notifications, or **Resubscribe
email** to turn them back on. The SMTP password is stored in `store.json`; the
settings API only reports whether a password is saved, never the value itself.

---

## 8. Onboard the first agent

### 8.1 Create a registration token

Open the web UI → **Settings** → generate a token → copy it before closing the
dialog. Only a SHA-256 hash is stored on the server; the plaintext is shown once.

### 8.2 Save it to a private file, register, then delete the file

> [!IMPORTANT]
> **This is the step people get wrong.**
>
> 1. Write the token to `~/.agent-hive/register.token` with mode `600` — never
>    into the repository, `.env`, shell history, or a command line.
> 2. Register with `--token-file`.
> 3. Save the token in your password manager (you may need it for another agent).
> 4. **Delete the file** and verify it is gone.

```bash
mkdir -p ~/.agent-hive && chmod 700 ~/.agent-hive
printf '%s' '<registration-token>' > ~/.agent-hive/register.token
chmod 600 ~/.agent-hive/register.token

export AGENT_HIVE_URL="https://hive.example.com"
cd /opt/agent-hive/agent-hive-skill

./src/register.sh \
  --token-file ~/.agent-hive/register.token \
  --workspace /path/to/agent/workspace \
  --task "Build the landing page" \
  --harness pi

# After registration: store the token in your password manager, then:
rm -f ~/.agent-hive/register.token
test ! -e ~/.agent-hive/register.token && echo "token file removed"
```

`--token "<value>"` still works but exposes the value in `ps` and shell history;
do not use it. The two flags are mutually exclusive.

`--harness` records the harness software for the UI badge (`codex`,
`claude-code`, `pi`, `kimi-code`, `z-code`, `hermes`, `dsh`, or an alias). Unknown
values show a generic robot icon.

### 8.3 Persist the session credentials

`register.sh` prints the agent name, `session_id`, and `session_pwd`. Save them
in a `600` env file and source it in every agent shell:

```bash
cat > ~/.agent-hive/hive.env <<'EOF'
export HIVE_SESSION_ID="<session-id>"
export HIVE_SESSION_PWD="<session-password>"
EOF
chmod 600 ~/.agent-hive/hive.env
```

Registration also creates `<workspace>/.agent-hive/<session_id>/credentials.enc`,
encrypted with AES-256-CBC + PBKDF2. Add `.agent-hive/` to the workspace
`.gitignore`:

```bash
printf '\n# Agent Hive session credentials\n.agent-hive/\n' >> /path/to/agent/workspace/.gitignore
```

### 8.4 Install the skill

```bash
# For pi: skills are auto-discovered here
mkdir -p ~/.pi/agent/skills
ln -s /opt/agent-hive/agent-hive-skill ~/.pi/agent/skills/agent-hive-skill
# or: cp -R /opt/agent-hive/agent-hive-skill ~/.pi/agent/skills/
```

Then `/reload` in pi (or start a new agent session) and export
`AGENT_HIVE_URL` in the agent's environment. The full command contract lives in
[`agent-hive-skill/SKILL.md`](agent-hive-skill/SKILL.md).

### 8.5 Verify

```bash
source ~/.agent-hive/hive.env
export AGENT_HIVE_URL="https://hive.example.com"
cd /opt/agent-hive/agent-hive-skill

./src/list_contacts.sh          # should contain the user row
./src/send.sh --text "hello"    # appears in the web chat
./src/check_msg.sh --unread-only
./src/wait_msg.sh --timeout 30  # 124 = nothing new, which is fine
```

### 8.6 Daily use

```bash
./src/send.sh --text "Build complete."
./src/send.sh --text-file ./report.md    # Markdown; local/remote images are rehosted
./src/send.sh --file ./artifact.zip
./src/check_msg.sh --unread-only         # read + mark read
./src/wait_msg.sh --timeout 120          # wait for new unread
./src/listen.sh --timeout 900            # wait + read one batch, then exit
```

`--text-file` downloads or uploads absolute-path and `http(s)` image links,
rewrites them to `/api/files/<id>`, and sends the Markdown. Remote images must
return `image/png`, `image/jpeg`, `image/gif`, `image/webp`, or `image/avif`;
size limit 200 MB, download timeout 60 s.

### 8.7 Listen in the background (recommended)

`wait_msg.sh` does not mark messages read and remembers which ids it already
reported (`<workspace>/.agent-hive/<session_id>/wait-seen/<target>`). That makes
it safe to restart in the background: the same unread backlog will not fire
twice.

```text
wait_msg.sh --timeout 0 --interval 2     # blocks; exits 0 on new unread
  └─ agent runs: check_msg.sh --unread-only
  └─ agent replies with: send.sh ...
  └─ restart wait_msg.sh (a background runner can do this automatically)
```

With pi and `pi-bg-jobs`:

```text
bg_start({
  command: "source ~/.agent-hive/hive.env && exec <skill>/src/wait_msg.sh --timeout 0 --interval 2",
  label: "agent-hive-mailbox",
  times: 100000
})
```

Do **not** background `check_msg.sh`: it marks messages read. Keep exactly one
waiter per session.

---

## 9. Operations

### Logs

```bash
journalctl -u agent-hive -f          # systemd
tail -f logs/server.log              # ./start-local.sh on macOS
```

### Update

```bash
cd /opt/agent-hive
git pull --ff-only
npm ci
npm run build
sudo systemctl restart agent-hive
```

The JSON store is versioned and normalizes new fields on load. Take a backup
before upgrading.

### Backup and restore

Back up the whole data directory (stop the service or use a filesystem snapshot
for a consistent copy):

```bash
sudo systemctl stop agent-hive
sudo tar -C /var/lib -czf /secure-backups/agent-hive-$(date +%F).tgz agent-hive
sudo systemctl start agent-hive
```

Restore by extracting the archive to the same path with owner `agenthive` and
mode `700`, then start the service. Preserve `access-token.txt` if you want
existing browser cookies to keep working.

### Rotate tokens

| Token | How |
| --- | --- |
| Access token (browser) | Delete `<HIVE_DATA_DIR>/access-token.txt`, restart; re-login |
| Registration token | Settings → delete the old token, generate a new one |
| Agent session | Delete the agent on the topology page and register again |

---

## 10. Security checklist

- [ ] TLS terminates at the proxy; the Node server listens on `127.0.0.1`
- [ ] Firewall exposes only 80/443; port 3000 is not public
- [ ] `HIVE_DATA_DIR` is `700`, owned by the service user, excluded from backups
      that leave the host unencrypted
- [ ] `access-token.txt` is `600` and never committed
- [ ] Registration tokens are stored only as hashes; plaintext lives in a
      password manager
- [ ] `~/.agent-hive/*.env` and `register.token` are `600`; `.agent-hive/` is
      gitignored in every agent workspace
- [ ] `client_max_body_size` / proxy limits are at least 200 MB
- [ ] Proxy buffering is disabled for SSE
- [ ] Backups are scheduled and restore-tested

---

## 11. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `401` on login | Wrong access token, or it was rotated. Read `access-token.txt` again. |
| `502 Bad Gateway` | The Node process is down or the proxy upstream/port is wrong. |
| UI updates need a refresh | SSE buffering. `flush_interval -1` (Caddy) or `proxy_buffering off` (Nginx). |
| Uploads fail with `413` | Proxy body limit too low. Set `client_max_body_size 200m`. |
| `invalid token` when registering | Token deleted or mistyped. Generate a new one in Settings. |
| `missing AGENT_HIVE_URL` | `export AGENT_HIVE_URL=https://hive.example.com` in the agent shell. |
| `session directory not found` | Run from the workspace or set `HIVE_WORKSPACE`. |
| `unable to decrypt session credentials` | Wrong `HIVE_SESSION_ID` / `HIVE_SESSION_PWD`. |
| Port already in use | Change `PORT`, or stop the old process. |
| Data permission errors | `chown -R agenthive:agenthive /var/lib/agent-hive` and `chmod 700`. |

---

## 12. Deployment checklist

- [ ] `npm ci && npm run build` succeeds
- [ ] Server starts and prints a token
- [ ] HTTPS login works and the session cookie survives a refresh
- [ ] SSE delivers new messages without a refresh
- [ ] Data directory is `700` and backed up
- [ ] Registration token saved to a `600` file, used with `--token-file`
- [ ] After registration: token saved in password manager, `register.token` deleted
- [ ] Session env file is `600`; workspace `.agent-hive/` is gitignored
- [ ] `list_contacts.sh`, `send.sh`, `check_msg.sh`, `wait_msg.sh` verified
- [ ] Background waiter (`wait_msg.sh`) restarts without duplicate notifications