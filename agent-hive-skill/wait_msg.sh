#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'EOF'
Usage: wait_msg.sh [--session_id TARGET] [--timeout SECONDS] [--interval SECONDS]

Wait until unread messages exist, print who sent the latest one and the total
unread count, then exit. Without --session_id, all conversations are watched.
TARGET restricts the wait to the user or a connected agent. This command does
not mark messages as read.

Options:
  --timeout    Maximum wait in seconds; 0 waits forever (default: 0)
  --interval   Poll interval in seconds, 1 to 60 (default: 2)

Environment:
  HIVE_SESSION_ID   Registered session id
  HIVE_SESSION_PWD  Session password
EOF
}

target=""
timeout="0"
interval="2"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session_id)
      [[ $# -ge 2 ]] || die "--session_id requires a value"
      target="$2"
      shift 2
      ;;
    --timeout)
      [[ $# -ge 2 ]] || die "--timeout requires a value"
      timeout="$2"
      shift 2
      ;;
    --interval)
      [[ $# -ge 2 ]] || die "--interval requires a value"
      interval="$2"
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

[[ "$timeout" =~ ^(0|[1-9][0-9]*)$ ]] || die "--timeout must be 0 or a positive number"
[[ "$interval" =~ ^[1-9][0-9]?$ ]] || die "--interval must be between 1 and 60"
[[ "$interval" -le 60 ]] || die "--interval must be between 1 and 60"

load_session

unread_path="/api/agent/unread"
if [[ -n "$target" ]]; then
  assert_contact "$target"
  encoded_target="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$target")"
  unread_path="/api/agent/unread?with=$encoded_target"
fi

printf 'Waiting for unread messages...\n' >&2
started=$SECONDS

while true; do
  body="$(http_get "$unread_path")"
  count="$(json_field unread_count "$body")"

  if [[ "$count" =~ ^[1-9][0-9]*$ ]]; then
    printf '%s' "$body" | python3 "$HIVE_PY" render-unread
    exit 0
  fi

  if [[ "$timeout" -gt 0 && $((SECONDS - started)) -ge "$timeout" ]]; then
    printf 'No unread messages within %s seconds.\n' "$timeout" >&2
    exit 0
  fi

  sleep "$interval"
done
