#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'EOF'
Usage: send.sh [--session_id TARGET] (--text TEXT | --text-file PATH) [--file PATH]

Send a message and/or one file to the user or to a connected agent. TARGET
defaults to "user". Files are limited to 50 MB.

--text and --text-file are mutually exclusive. With --text-file the file is read
as Markdown; image links that point at absolute local paths are uploaded to the
server first, then rewritten to server-served URLs (/api/files/<id>) before the
message is sent. Paths containing spaces can use angle brackets:
  ![alt](</absolute/path with spaces.png>)

Environment:
  HIVE_SESSION_ID   Registered session id
  HIVE_SESSION_PWD  Session password
EOF
}

target="user"
text=""
text_file=""
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
    --text-file)
      [[ $# -ge 2 ]] || die "--text-file requires a value"
      text_file="$2"
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

if [[ -n "$text" && -n "$text_file" ]]; then
  die "--text and --text-file cannot be used together"
fi

if [[ -n "$text_file" ]]; then
  [[ -f "$text_file" ]] || die "text file not found: $text_file"
  text="$(cat "$text_file")"
fi

if [[ -z "$text" && -z "$file" ]]; then
  die "provide --text/--text-file and/or --file"
fi

if [[ -n "$file" ]]; then
  [[ -f "$file" ]] || die "file not found: $file"
  file_size="$(wc -c <"$file" | tr -d '[:space:]')"
  [[ "$file_size" -le "$MAX_FILE_SIZE" ]] || die "file exceeds the 50 MB limit"
fi

load_session
assert_contact "$target"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# Upload local images referenced by the Markdown and rewrite their links to
# server URLs. Only absolute paths are touched; remote URLs are left alone.
if [[ -n "$text" ]]; then
  image_paths="$(printf '%s' "$text" | python3 "$HIVE_PY" md-image-paths)"
  if [[ -n "$image_paths" ]]; then
    image_map="$tmpdir/image-map.json"
    printf '{}' >"$image_map"

    while IFS= read -r image_path; do
      [[ -n "$image_path" ]] || continue
      [[ "$image_path" == /* ]] || die "image path must be absolute: $image_path"
      [[ -f "$image_path" ]] || die "image not found: $image_path"

      extension="$(printf '%s' "${image_path##*.}" | tr '[:upper:]' '[:lower:]')"
      case "$extension" in
        png|jpg|jpeg|gif|webp|avif) ;;
        *) die "unsupported image type (use png/jpg/jpeg/gif/webp/avif): $image_path" ;;
      esac

      image_size="$(wc -c <"$image_path" | tr -d '[:space:]')"
      [[ "$image_size" -le "$MAX_FILE_SIZE" ]] || die "image exceeds the 50 MB limit: $image_path"

      upload_response_file="$tmpdir/upload.json"
      if ! upload_status="$(
        curl -sS -o "$upload_response_file" -w '%{http_code}' \
          --connect-timeout 10 \
          -X POST \
          -H "X-Hive-Session-Id: $HIVE_SESSION_ID" \
          -H "X-Hive-Session-Pwd: $HIVE_SESSION_PWD" \
          -F "file=@${image_path}" \
          "$SERVER_URL/api/agent/files"
      )"; then
        die "unable to reach $SERVER_URL"
      fi

      upload_response="$(cat "$upload_response_file")"
      if [[ "$upload_status" -lt 200 || "$upload_status" -ge 300 ]]; then
        die "$(response_error "$upload_response" "$upload_status")"
      fi

      uploaded_file="$(json_field file "$upload_response")"
      image_url="$(json_field url "$uploaded_file")"
      [[ -n "$image_url" ]] || die "server did not return an image URL for $image_path"

      python3 "$HIVE_PY" md-add-image "$image_map" "$image_path" "$image_url"
    done <<<"$image_paths"

    text="$(printf '%s' "$text" | HIVE_IMAGE_MAP_FILE="$image_map" python3 "$HIVE_PY" md-replace-images)"
  fi
fi

response_file="$tmpdir/response.json"

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