#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'EOF'
Usage: listen.sh [--session_id TARGET] [--timeout SECONDS] [--interval SECONDS] [--once]

Stay online and print each batch of unread messages as it arrives. The loop
waits for unread messages, prints only those (they are marked read), and then
keeps waiting. TARGET defaults to "user"; omit --session_id to watch every
conversation. Use Ctrl-C to stop.

Options:
  --session_id   Watch one conversation (default: user)
  --timeout      Overall wall-clock limit in seconds; 0 waits forever (default: 0)
  --interval     Poll interval in seconds, 1 to 60 (default: 2)
  --once         Print the first batch, then exit instead of looping

Exit status:
  0    --once completed, or the loop was interrupted with Ctrl-C
  124  --timeout elapsed with no unread message in the window

Environment:
  HIVE_SESSION_ID   Registered session id
  HIVE_SESSION_PWD  Session password
EOF
}

target="user"
watch_all="0"
timeout="0"
interval="2"
once="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session_id)
      [[ $# -ge 2 ]] || die "--session_id requires a value"
      target="$2"
      watch_all="0"
      shift 2
      ;;
    --all)
      watch_all="1"
      shift
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
    --once)
      once="1"
      shift
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

# Fail fast on a broken session instead of looping on a bad credential.
load_session
if [[ "$watch_all" != "1" ]]; then
  assert_contact "$target"
fi

started=$SECONDS
wait_err="$(mktemp)"
trap 'rm -f "$wait_err"' EXIT

while true; do
  remaining="0"
  if [[ "$timeout" -gt 0 ]]; then
    remaining=$((timeout - (SECONDS - started)))
    if [[ "$remaining" -le 0 ]]; then
      printf 'No unread messages within %s seconds.\n' "$timeout" >&2
      exit 124
    fi
  fi

  wait_args=(--interval "$interval" --timeout "$remaining")
  if [[ "$watch_all" != "1" ]]; then
    wait_args+=(--session_id "$target")
  fi

  set +e
  "$SCRIPT_DIR/wait_msg.sh" "${wait_args[@]}" 2>"$wait_err"
  wait_status=$?
  set -e

  # wait_msg.sh reports its own slice timeout; print the overall window instead.
  if [[ "$wait_status" -eq 124 ]]; then
    printf 'No unread messages within %s seconds.\n' "$timeout" >&2
    exit 124
  fi
  if [[ -s "$wait_err" ]]; then
    cat "$wait_err" >&2
  fi
  if [[ "$wait_status" -ne 0 ]]; then
    exit "$wait_status"
  fi

  echo "-----"
  check_args=(--last 200 --unread-only)
  if [[ "$watch_all" != "1" ]]; then
    check_args+=(--session_id "$target")
  fi
  "$SCRIPT_DIR/check_msg.sh" "${check_args[@]}"

  if [[ "$once" == "1" ]]; then
    exit 0
  fi
done