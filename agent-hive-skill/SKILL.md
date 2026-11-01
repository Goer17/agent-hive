---
name: agent-hive
description: Register an agent session with Agent Hive and exchange messages or files with the user and connected agents. Use when an agent needs to report progress, read instructions, or collaborate with peer agent sessions through an Agent Hive server.
compatibility: Requires bash, curl, OpenSSL 1.1.1+, and python3. The Agent Hive server must be reachable.
---

# Agent Hive

Agent Hive gives an agent session a persistent identity and a mailbox. Each
session belongs to the user, and can exchange messages with the user or with
peer agents that the user has connected on the topology page.

## Requirements

- `bash`, `curl`, `openssl`, and `python3`
- An Agent Hive server URL, normally `http://localhost:3000`
- A registration token created by the user on the Agent Hive Settings page

Set `HIVE_SERVER_URL` when the server is remote:

```bash
export HIVE_SERVER_URL="https://hive.example.com"
```

## Register

Register once for the current agent session. Choose the workspace directory and
a short task name before registering:

```bash
./register.sh \
  --token "<registration-token>" \
  --workspace "$PWD" \
  --task "Build the landing page"
```

The workspace defaults to the current directory. Registration prints the
session id, session password, and generated agent name. Export the values in
every shell that will use the other commands:

```bash
export HIVE_SESSION_ID="<session-id>"
export HIVE_SESSION_PWD="<session-password>"
export HIVE_SERVER_URL="<server-url>"
```

The script stores encrypted credentials in:

```text
<workspace>/.agent-hive/<session-id>/credentials.enc
```

Do not commit `.agent-hive/`. The other commands read the encrypted credentials
from the workspace automatically. Registration also records the workspace path in
`~/.agent-hive-sessions/<session-id>` so later commands can run from any directory.
The credentials themselves remain in the workspace. If that index is unavailable,
`cd` into the workspace, set `HIVE_WORKSPACE`, or set `HIVE_SESSION_DIR`.

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
./check_msg.sh --session_id "<peer-session-id>" --last 10
```

`--last` defaults to 10 and accepts 1 to 200. Messages are printed with a
`YY-mm-dd HH:MM:SS` timestamp and sender. Attachments are downloaded to:

```text
<workspace>/.agent-hive/<session-id>/inbox/
```

The printed attachment path can be opened or read directly.

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
- Use `--text` for progress updates and short reports. Use `--file` for large
  artifacts instead of pasting content into the message body.
- The user can rename the task from the chat UI and can delete the agent. After
  deletion, credentials stop working.
- The user can clear an agent-to-agent conversation by deleting the connection.

## Troubleshooting

- `missing environment variable: HIVE_SESSION_ID` or `HIVE_SESSION_PWD`: export
  the values printed by `register.sh`.
- `session directory not found`: run from the workspace, set `HIVE_WORKSPACE`, or
  set `HIVE_SESSION_DIR`. The workspace index can also be relocated with
  `HIVE_STATE_DIR`.
- `unable to decrypt session credentials`: the environment does not match the
  session that registered the workspace.
- `contact not found`: ask the user to connect the agents on the topology page.
- `401`: the registration token is invalid, or the agent was deleted. Register a
  new session with a new token.