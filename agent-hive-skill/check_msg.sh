#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'EOF'
Usage: check_msg.sh [--session_id TARGET] [--last COUNT] [--unread-only]

Read recent messages exchanged with the user or a connected agent. TARGET
defaults to "user" and COUNT defaults to 10. Attachments are downloaded to
<workspace>/.agent-hive/<session_id>/inbox/. This command does not wait; use
wait_msg.sh to block until unread messages exist.

With --unread-only only messages that are still unread are printed and marked
read, which keeps long-running listeners free of already-handled messages.

Environment:
  HIVE_SESSION_ID   Registered session id
  HIVE_SESSION_PWD  Session password
EOF
}

target="user"
last="10"
unread_only="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --unread-only)
      unread_only="1"
      shift
      ;;
    --session_id)
      [[ $# -ge 2 ]] || die "--session_id requires a value"
      target="$2"
      shift 2
      ;;
    --last)
      [[ $# -ge 2 ]] || die "--last requires a value"
      last="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

[[ "$last" =~ ^[1-9][0-9]{0,2}$ ]] || die "--last must be between 1 and 200"
[[ "$last" -le 200 ]] || die "--last must be between 1 and 200"

load_session
assert_contact "$target"

encoded_target="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$target")"
body="$(http_get "/api/agent/messages?with=$encoded_target&last=$last")"

if [[ "$unread_only" == "1" ]]; then
  body="$(printf '%s' "$body" | python3 "$HIVE_PY" filter-unread)"
  if ! printf '%s' "$body" | python3 "$HIVE_PY" has-messages; then
    printf 'No unread messages.\n'
    exit 0
  fi
fi

printf '%s' "$body" |
  HIVE_INBOX_DIR="$SESSION_DIR/inbox" \
  HIVE_SERVER_URL="$SERVER_URL" \
  python3 "$HIVE_PY" render-messages

read_payload="$(
  printf '%s' "$body" |
    HIVE_TARGET="$target" \
    python3 "$HIVE_PY" make-read-json
)"
http_post_json "/api/agent/messages/read" "$read_payload" >/dev/null
