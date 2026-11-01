#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'EOF'
Usage: send.sh [--session_id TARGET] [--text TEXT] [--file PATH]

Send a message and/or one file to the user or to a connected agent. TARGET
defaults to "user". Files are limited to 50 MB.

Environment:
  HIVE_SESSION_ID   Registered session id
  HIVE_SESSION_PWD  Session password
EOF
}

target="user"
text=""
file=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session_id)
      [[ $# -ge 2 ]] || die "--session_id requires a value"
      target="$2"
      shift 2
      ;;
    --text)
      [[ $# -ge 2 ]] || die "--text requires a value"
      text="$2"
      shift 2
      ;;
    --file)
      [[ $# -ge 2 ]] || die "--file requires a value"
      file="$2"
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

if [[ -z "$text" && -z "$file" ]]; then
  die "provide --text and/or --file"
fi

if [[ -n "$file" ]]; then
  [[ -f "$file" ]] || die "file not found: $file"
  file_size="$(wc -c <"$file" | tr -d '[:space:]')"
  [[ "$file_size" -le "$MAX_FILE_SIZE" ]] || die "file exceeds the 50 MB limit"
fi

load_session
assert_contact "$target"

response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT

curl_args=(
  -sS
  -o "$response_file"
  -w '%{http_code}'
  --connect-timeout 10
  -X POST
  -H "X-Hive-Session-Id: $HIVE_SESSION_ID"
  -H "X-Hive-Session-Pwd: $HIVE_SESSION_PWD"
  --form-string "to=$target"
)

if [[ -n "$text" ]]; then
  curl_args+=(--form-string "text=$text")
fi
if [[ -n "$file" ]]; then
  curl_args+=(-F "file=@${file}")
fi

if ! status="$(curl "${curl_args[@]}" "$SERVER_URL/api/agent/messages")"; then
  die "unable to reach $SERVER_URL"
fi

response="$(cat "$response_file")"
if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
  die "$(response_error "$response" "$status")"
fi

printf 'Sent to %s.\n' "$target"