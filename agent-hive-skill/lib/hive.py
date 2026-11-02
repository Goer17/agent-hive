#!/usr/bin/env python3
"""JSON helpers for the agent-hive shell scripts."""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def fail(message: str, code: int = 1) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(code)


def read_json():
    try:
        return json.load(sys.stdin)
    except json.JSONDecodeError:
        fail("server returned an invalid JSON response")


def human_size(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    kb = size / 1024
    if kb < 1024:
        return f"{kb:.1f} KB" if kb < 10 else f"{kb:.0f} KB"
    mb = kb / 1024
    return f"{mb:.1f} MB" if mb < 10 else f"{mb:.0f} MB"


def parse_timestamp(value: str) -> str:
    normalized = value.strip()
    try:
        if normalized.endswith("Z"):
            normalized = normalized[:-1] + "+0000"
        if "." in normalized:
            parsed = datetime.strptime(normalized, "%Y-%m-%dT%H:%M:%S.%f%z")
        else:
            parsed = datetime.strptime(normalized, "%Y-%m-%dT%H:%M:%S%z")
        return parsed.astimezone().strftime("%y-%m-%d %H:%M:%S")
    except ValueError:
        return value


def cmd_get(key: str) -> None:
    data = read_json()
    value = data.get(key)
    if value is None:
        raise SystemExit(1)
    if isinstance(value, (dict, list)):
        print(json.dumps(value))
    else:
        print(value)


def cmd_make_register_json() -> None:
    payload = {
        "token": os.environ.get("HIVE_TOKEN", ""),
        "workspace": os.environ.get("HIVE_WORKSPACE", "."),
        "task": os.environ.get("HIVE_TASK", ""),
        "host": os.environ.get("HIVE_HOST", ""),
    }
    print(json.dumps(payload, separators=(",", ":")))


def cmd_make_credentials() -> None:
    response = read_json()
    credentials = {
        "session_id": response.get("session_id"),
        "session_pwd": response.get("session_pwd"),
        "name": response.get("name"),
        "host": response.get("host") or os.environ.get("HIVE_HOST", ""),
        "workspace": response.get("workspace") or os.environ.get("HIVE_WORKSPACE", "."),
        "task": response.get("task", ""),
        "server_url": os.environ.get("HIVE_SERVER_URL", "http://localhost:3000"),
        "registered_at": datetime.now(timezone.utc).isoformat(),
        "format": 1,
    }
    for key in ("session_id", "session_pwd", "name"):
        if not credentials[key]:
            fail(f"registration response is missing {key}")
    print(json.dumps(credentials, separators=(",", ":")))


def cmd_last_message_id() -> None:
    data = read_json()
    messages = data.get("messages") or []
    if messages:
        print(messages[-1].get("id", ""))


def cmd_has_messages() -> None:
    data = read_json()
    messages = data.get("messages") or []
    raise SystemExit(0 if messages else 1)


def cmd_filter_unread() -> None:
    data = read_json()
    output = dict(data)
    output["messages"] = [
        message for message in (data.get("messages") or []) if not message.get("read")
    ]
    print(json.dumps(output, separators=(",", ":")))

PAGE_LIMIT = 200


def agent_get(path):
    """GET an agent API path with the session headers; never raises on 4xx."""
    server_url = os.environ.get("HIVE_SERVER_URL", "http://localhost:3000").rstrip("/")
    request = urllib.request.Request(
        f"{server_url}{path}",
        headers={
            "X-Hive-Session-Id": os.environ.get("HIVE_SESSION_ID", ""),
            "X-Hive-Session-Pwd": os.environ.get("HIVE_SESSION_PWD", ""),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as error:
        try:
            payload = json.loads(error.read().decode())
        except (json.JSONDecodeError, OSError, UnicodeDecodeError):
            payload = {}
        return error.code, payload
    except (urllib.error.URLError, OSError):
        fail(f"unable to reach {server_url}")


def cmd_fetch_unread() -> None:
    """Page forward from the stored cursor and print every message since then.

    `after=<message id>` returns the messages that follow a known id, so a
    listener can walk forward in PAGE_LIMIT chunks instead of silently dropping
    anything older than a `last=N` window. The cursor is only moved by the
    caller (HIVE_FETCH_CURSOR_OUT) once the batch was actually handled.
    """
    target = os.environ.get("HIVE_FETCH_TARGET", "user")
    cursor_file = os.environ.get("HIVE_FETCH_CURSOR_FILE", "")
    cursor_out = os.environ.get("HIVE_FETCH_CURSOR_OUT", "")
    bootstrap = int(os.environ.get("HIVE_FETCH_BOOTSTRAP", "200") or 200)
    quoted = urllib.parse.quote(target, safe="")

    cursor = ""
    if cursor_file and os.path.exists(cursor_file):
        try:
            cursor = Path(cursor_file).read_text(encoding="utf-8").strip()
        except OSError:
            cursor = ""

    contact = None
    messages = []
    paged = False

    if cursor:
        next_cursor = cursor
        while True:
            status, data = agent_get(
                f"/api/agent/messages?with={quoted}&after={urllib.parse.quote(next_cursor, safe='')}"
            )
            if status == 400:
                # The cursor message is gone (conversation cleared, store reset).
                # Start over from the newest window instead of failing the call.
                cursor = ""
                messages = []
                break
            if status != 200:
                fail(f"request failed (HTTP {status}): {data.get('error', 'unknown error')}")
            contact = data.get("contact") or contact
            page = data.get("messages") or []
            messages.extend(page)
            paged = True
            if len(page) < PAGE_LIMIT:
                break
            next_cursor = str(page[-1].get("id") or "")
            if not next_cursor:
                break

    if not paged:
        status, data = agent_get(f"/api/agent/messages?with={quoted}&last={bootstrap}")
        if status != 200:
            fail(f"request failed (HTTP {status}): {data.get('error', 'unknown error')}")
        contact = data.get("contact")
        messages = data.get("messages") or []

    print(json.dumps({"contact": contact, "messages": messages}, separators=(",", ":")))

    newest = str((messages[-1] or {}).get("id") or "") if messages else ""
    if cursor_out and newest:
        try:
            Path(cursor_out).write_text(newest, encoding="utf-8")
        except OSError:
            fail(f"unable to write cursor file: {cursor_out}")


def cmd_make_read_json() -> None:
    data = read_json()
    ids = [
        str(message.get("id", ""))
        for message in (data.get("messages") or [])
        if message.get("id")
    ]
    target = os.environ.get("HIVE_TARGET", "user")
    chunk = int(os.environ.get("HIVE_READ_CHUNK", "0") or 0)
    # The read endpoint accepts at most 200 ids per call, and paging can surface
    # far more than that in one batch, so emit one payload per chunk.
    size = chunk if chunk > 0 else max(len(ids), 1)
    payloads = [
        {"with": target, "ids": ids[start:start + size]}
        for start in range(0, len(ids), size)
    ] or [{"with": target, "ids": []}]
    for payload in payloads:
        print(json.dumps(payload, separators=(",", ":")))


def cmd_render_unread() -> None:
    data = read_json()
    count = int(data.get("unread_count") or 0)
    latest = data.get("latest") or {}
    noun = "message" if count == 1 else "messages"
    if not latest:
        print(f"{count} unread {noun}.")
        return
    sender = (latest.get("from") or {}).get("name", "unknown")
    timestamp = parse_timestamp(str(latest.get("created_at", "")))
    print(f"{count} unread {noun}. Latest from {sender} at {timestamp}.")


def cmd_has_contact(target: str) -> None:
    data = read_json()
    contacts = data.get("contacts") or []
    if not any(item.get("session_id") == target for item in contacts):
        raise SystemExit(1)


def cmd_render_contacts() -> None:
    data = read_json()
    contacts = data.get("contacts") or []
    rows = [("SESSION_ID", "NAME", "TASK")]
    for contact in contacts:
        rows.append(
            (
                str(contact.get("session_id", "")),
                str(contact.get("name", "")),
                str(contact.get("task", "-") or "-"),
            )
        )
    widths = [max(len(row[index]) for row in rows) for index in range(3)]
    for row in rows:
        print(
            f"{row[0].ljust(widths[0])}  "
            f"{row[1].ljust(widths[1])}  "
            f"{row[2]}"
        )


def safe_file_name(name: str) -> str:
    cleaned = Path(name.replace("\\", "/")).name
    cleaned = re.sub(r"[^A-Za-z0-9._ -]", "_", cleaned).strip()
    return (cleaned or "file")[:180]


def download_file(file: dict, inbox: Path, server_url: str) -> str:
    inbox.mkdir(parents=True, exist_ok=True, mode=0o700)
    message_id = str(file.get("_message_id", ""))[:8]
    name = safe_file_name(str(file.get("name", "file")))
    destination = inbox / f"{message_id}-{name}"
    if destination.exists():
        return str(destination)

    url = f"{server_url}{file.get('url', '')}"
    request = urllib.request.Request(
        url,
        headers={
            "X-Hive-Session-Id": os.environ.get("HIVE_SESSION_ID", ""),
            "X-Hive-Session-Pwd": os.environ.get("HIVE_SESSION_PWD", ""),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            destination.write_bytes(response.read())
        destination.chmod(0o600)
        return str(destination)
    except (urllib.error.URLError, OSError) as error:
        return f"download failed: {error}"


def cmd_render_messages() -> None:
    data = read_json()
    messages = data.get("messages") or []
    inbox = Path(os.environ.get("HIVE_INBOX_DIR", "inbox"))
    server_url = os.environ.get("HIVE_SERVER_URL", "http://localhost:3000").rstrip("/")
    if not messages:
        print("No messages.")
        return

    for message in messages:
        timestamp = parse_timestamp(str(message.get("created_at", "")))
        sender = message.get("from", {}).get("name", "unknown")
        print(f"[{timestamp}] {sender}:")
        text = str(message.get("text", ""))
        if text:
            for line in text.splitlines() or [""]:
                print(f"  {line}")
        attachment = message.get("file")
        if attachment:
            file_info = dict(attachment)
            file_info["_message_id"] = message.get("id", "")
            destination = download_file(file_info, inbox, server_url)
            print(
                f"  [file] {attachment.get('name', 'file')} "
                f"({human_size(int(attachment.get('size', 0)))}) -> {destination}"
            )
        print()


def main() -> None:
    if len(sys.argv) < 2:
        fail("missing command")
    command = sys.argv[1]
    if command == "get" and len(sys.argv) == 3:
        cmd_get(sys.argv[2])
    elif command == "make-register-json":
        cmd_make_register_json()
    elif command == "make-credentials":
        cmd_make_credentials()
    elif command == "last-message-id":
        cmd_last_message_id()
    elif command == "has-messages":
        cmd_has_messages()
    elif command == "filter-unread":
        cmd_filter_unread()
    elif command == "fetch-unread":
        cmd_fetch_unread()
    elif command == "make-read-json":
        cmd_make_read_json()
    elif command == "render-unread":
        cmd_render_unread()
    elif command == "has-contact" and len(sys.argv) == 3:
        cmd_has_contact(sys.argv[2])
    elif command == "render-contacts":
        cmd_render_contacts()
    elif command == "render-messages":
        cmd_render_messages()
    else:
        fail(f"unknown command: {' '.join(sys.argv[1:])}")


if __name__ == "__main__":
    main()
