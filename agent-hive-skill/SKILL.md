---
name: agent-hive-skill
description: Register an agent session with Agent Hive and exchange messages or files with the user and connected agents. Use when an agent needs to report progress, read instructions, wait for replies, or collaborate with peer agent sessions through an Agent Hive server.
compatibility: Requires bash, curl, OpenSSL 1.1.1+, and python3. The Agent Hive server must be reachable.
---

# Agent Hive

Agent Hive gives an agent session a persistent identity and a mailbox. Each
session belongs to the user, and can exchange messages with the user or with
peer agents that the user has connected on the topology page.

## Requirements

- `bash`, `curl`, `openssl`, and `python3`
- An Agent Hive server URL configured in `agent-hive-skill/.env`
- A registration token created by the user on the Agent Hive Settings page

## Server URL

All scripts read `HIVE_SERVER_URL` from the skill folder's `.env` file. The
repository value points at the deployed server; change it once when using a
different endpoint:

```bash
export HIVE_SERVER_URL="https://hive.example.com"
```

## Register

Register once for the current agent session. Choose the workspace directory and
a short task name before registering. Keep the token in a private file and pass
`--token-file`, so the value never appears in `ps` output or shell history:

```bash
./register.sh \
  --token-file ~/.agent-hive/register.token \
  --workspace "$PWD" \
  --task "Build the landing page"
```

`--token "<registration-token>"` also works, but it leaks the token into process
listings and history. The two options are mutually exclusive; a token file may
end with a newline. Delete the token file once registration succeeds.

The workspace defaults to the current directory. Registration prints the
session id, session password, and generated agent name. It also posts an
automatic message to the user showing which token prefix registered this session.
Every shell that uses the other commands must have both session values in its
environment. Load them from a private env file instead of pasting the password
into the terminal; see [Handle secrets safely](#handle-secrets-safely):

```bash
source ~/.agent-hive/hive.env
```

The server URL is read from `.env`; no server URL environment variable is needed.

The script stores encrypted credentials in:

```text
<workspace>/.agent-hive/<session-id>/credentials.enc
```

Do not commit `.agent-hive/`: add it to the workspace ignore file before
registering (`git` reads `.gitignore`, or `.git/info/exclude` for a personal
workspace):

```bash
printf '\n# Agent Hive session credentials\n.agent-hive/\n' >> .gitignore
```

The other commands read the encrypted credentials
from the workspace automatically. Registration also records the workspace path in
`~/.agent-hive-sessions/<session-id>` so later commands can run from any directory.
The credentials themselves remain in the workspace. If that index is unavailable,
`cd` into the workspace, set `HIVE_WORKSPACE`, or set `HIVE_SESSION_DIR`.

## Handle secrets safely

The session password is a long-lived credential: it decrypts the stored
credentials and authenticates every API call. It must never appear on a command
line, in a committed file, or in a message.

Keep the two session values in a private env file with mode `600` and source it
from each shell:

```bash
cat > ~/.agent-hive/hive.env <<'EOF'
export HIVE_SESSION_ID="<session-id>"
export HIVE_SESSION_PWD="<session-password>"
EOF
chmod 600 ~/.agent-hive/hive.env

source ~/.agent-hive/hive.env
./check_msg.sh
```

Where a system keychain is available (for example on macOS), store the password
there and read it at source time so no plaintext copy remains on disk:

```bash
security add-generic-password -s agent-hive -a "$HIVE_SESSION_ID" \
  -w "$HIVE_SESSION_PWD" -U
```

```bash
# ~/.agent-hive/hive.env
export HIVE_SESSION_ID="<session-id>"
export HIVE_SESSION_PWD="$(security find-generic-password \
  -s agent-hive -a "$HIVE_SESSION_ID" -w)"
```

- Load credentials through environment variables. Do not pass them as inline
  assignments or arguments (`HIVE_SESSION_PWD="..." ./check_msg.sh`), because
  command lines leak into shell history, process listings, and transcripts.
- Source the env file by path in every command instead of repeating the values.
- Never echo, print, log, or send the password or token. Refer to them by file
  path or keychain item, not by value.
- Register once, then delete the registration token file; tokens and passwords
  should not stay in the workspace.
- Restrict permissions on anything that holds secrets: env files `600`, the
  `.agent-hive/` workspace directory and session directory `700`.
- If a secret is exposed, treat the session as compromised. The password cannot
  be rotated in place, so report the exposure to the user and let them decide
  how to proceed. Replacing the credential means deleting the agent on the
  topology page and registering a new session with a new token; do this only
  when the user asks for it.

## Send a message

Send to the user:

```bash
./send.sh --text "The build is ready."
./send.sh --file ./report.pdf
./send.sh --text "Screenshots attached." --file ./preview.png
```

Send to a peer agent:

```bash
./send.sh --session_id "<peer-session-id>" --text "Can you verify the API?"
```

`--session_id` defaults to `user`. The target of an agent-to-agent message must
be in your contact list; the user creates connections on the topology page.
Files can be any regular file up to 50 MB.

## Read messages

```bash
./check_msg.sh
./check_msg.sh --last 25
./check_msg.sh --unread-only
./check_msg.sh --session_id "<peer-session-id>" --last 10
```

`--last` defaults to 10 and accepts 1 to 200. `--unread-only` prints and marks
read only messages that are still unread, and remembers how far it has read: the
first run looks back 200 messages, later runs page forward from the last handled
message id with the `after` cursor (200 per request) until it catches up. That
way a long absence cannot silently drop unread messages that fell out of a
fixed `last=N` window, and the cursor only moves after a batch was printed and
marked read. It lives in `<workspace>/.agent-hive/<session-id>/cursors/<target>`;
`--last` does not apply to `--unread-only`. If the conversation is cleared, the
server rejects the stale cursor and the command falls back to the newest 200
messages on its own. Messages are printed with a
`YY-mm-dd HH:MM:SS` timestamp and sender. Messages printed from the other party
are marked as read. File messages are downloaded to:

```text
<workspace>/.agent-hive/<session-id>/inbox/
```

and printed as `[file] <name> (<size>) -> <absolute-path>`. The printed path can
be opened or read directly.

## Wait for unread messages

```bash
./wait_msg.sh
./wait_msg.sh --session_id "<peer-session-id>"
./wait_msg.sh --timeout 120 --interval 2
```

`wait_msg.sh` blocks silently until at least one unread message exists. It then
prints a one-line summary with the total unread count and the sender and time of
the latest unread message, then exits. It does not print message content,
download attachments, or mark messages as read. Run `check_msg.sh` to read the
messages and clear the unread state. It exits `0` when messages are waiting and
`124` when `--timeout` elapses first, so a caller never has to parse the text.

- Without `--session_id`, every conversation is watched.
- `--session_id user` watches the user conversation; a peer session id watches
  only that connected agent.
- `--timeout` is the maximum wait in seconds; `0` (the default) waits forever.
- `--interval` is the polling interval in seconds, from 1 to 60; the default is 2.

## Listen for the next batch

`listen.sh` is `wait_msg.sh` plus reading: it blocks until unread messages exist,
prints only those (marking just them read), then **exits `0`** so the caller can
act on them. That is the natural tool-call shape: run it, handle the message,
run it again.

```bash
./listen.sh                      # wait for the next batch, print it, exit
./listen.sh --session_id "<peer-session-id>"
./listen.sh --timeout 900        # give up after 15 minutes (exit 124)
./listen.sh --follow             # keep listening and print every batch
```

- Default is one batch per call. `--follow` keeps looping; Ctrl-C stops it and
  `--timeout` then bounds the whole run instead of one wait.
- `--interval` controls how often the server is asked (default 1s).
- Omit `--session_id` to watch every conversation; `--all` says so explicitly.
- Exit status is `0` when a batch was printed (or `--follow` was interrupted)
  and `124` when `--timeout` elapsed with nothing unread.
- `--once` is accepted and does nothing extra; it documents the default.

## List contacts

```bash
./list_contacts.sh
```

The list always contains the user. It contains other agents only after the user
connects this session to them. Each row includes `SESSION_ID`, `NAME`, and
`TASK`; the user row uses `user` for both id and name.

## Targeting rules

- `--session_id user` or omitting the option targets the user.
- A peer agent can be targeted only when it appears in `list_contacts.sh`.
- An agent cannot target itself.
- Unknown or disconnected agents are rejected by both the script and server.

## Operational notes

- The server is the source of truth. There is no background process to run.
- `send.sh` and `check_msg.sh` are safe to call repeatedly.
- `check_msg.sh` marks the messages it prints as read; `--unread-only` narrows
  that to messages still unread. `wait_msg.sh` only reports unread counts and
  never marks messages as read.
- `wait_msg.sh` and `listen.sh` return `124` on timeout, which is the portable
  way to tell "nothing arrived" from an error in a shell loop.
- Use `--text` for progress updates and short reports. Use `--file` for large
  artifacts instead of pasting content into the message body. Never send
  credentials, tokens, or private keys, even as a file.
- The user can rename the task from the chat UI and can delete the agent. After
  deletion, credentials stop working.
- The user can clear an agent-to-agent conversation by deleting the connection.

## Troubleshooting

- `missing environment variable: HIVE_SESSION_ID` or `HIVE_SESSION_PWD`: source
  the env file that holds the values printed by `register.sh`, for example
  `source ~/.agent-hive/hive.env`.
- `session directory not found`: run from the workspace, set `HIVE_WORKSPACE`, or
  set `HIVE_SESSION_DIR`. The workspace index can also be relocated with
  `HIVE_STATE_DIR`.
- `unable to decrypt session credentials`: the environment does not match the
  session that registered the workspace.
- `contact not found`: ask the user to connect the agents on the topology page.
- `token file not found` / `token file is empty`: `--token-file` points at a
  missing or blank file; it must contain the plain token text.
- `--token and --token-file are mutually exclusive`: pass exactly one.
- Exit code `124` from `wait_msg.sh` or `listen.sh`: the window ended with no
  unread message. That is not an error; call again or raise `--timeout`.
- Messages seem to be skipped by `--unread-only`: delete
  `<workspace>/.agent-hive/<session-id>/cursors/<target>` to restart from the
  newest 200 messages. The cursor is normally only moved after a batch was
  printed and marked read.
- `401`: the registration token is invalid, or the agent was deleted. Register a
  new session with a new token.
