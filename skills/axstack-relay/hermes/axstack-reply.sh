#!/bin/bash
# stdin is data. Python handles parsing, hashing and JSON encoding without a shell.
set -eu
umask 077
exec python3 -c '
import datetime, fcntl, hashlib, json, os, re, sys

message = sys.stdin.read()
match = re.fullmatch(r"\[Replying to: \"(.*?)\"\]\r?\n\r?\n(.*)", message, re.S)
if not match:
    sys.exit("reply rejected: missing quoted reply envelope")
quoted, reply = match.groups()
body = quoted.rstrip()
tags = re.findall(r"^T3 reply:.*$", body, re.M)
tag = re.fullmatch(r"T3 reply: ([A-Za-z0-9._-]+) thread ([A-Za-z0-9:._-]+)", tags[0]) if len(tags) == 1 else None
if not tag or body.splitlines()[-1] != tags[0]:
    sys.exit("reply rejected: expected exactly one final reply tag")
env, thread = tag.groups()
if env in (".", "..") or thread.startswith(".") or ".." in thread:
    sys.exit("reply rejected: unsafe identity")
entry = dict(receivedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
             env=env, threadId=thread, quotedSha256=hashlib.sha256(body.encode()).hexdigest(),
             quoted=quoted, reply=reply)
path = os.path.join(os.environ["HOME"], ".local", "share")
os.makedirs(path, mode=0o700, exist_ok=True)
for part in ("axstack", "relay-inbox", env):
    path = os.path.join(path, part)
    if os.path.islink(path):
        sys.exit("reply rejected: inbox directory is a symlink")
    os.makedirs(path, mode=0o700, exist_ok=True)
    os.chmod(path, 0o700)
fd = os.open(os.path.join(path, thread + ".jsonl"),
             os.O_WRONLY | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW, 0o600)
try:
    os.fchmod(fd, 0o600)
    payload = (json.dumps(entry, ensure_ascii=False) + "\n").encode()
    # Serialize append and rollback so a short write cannot poison the next line.
    fcntl.flock(fd, fcntl.LOCK_EX)
    start = os.lseek(fd, 0, os.SEEK_END)
    try:
        if os.write(fd, payload) != len(payload):
            raise OSError("incomplete append")
    except OSError:
        os.ftruncate(fd, start)
        raise
finally:
    os.close(fd)
print("Reply saved for T3 driver " + env + " thread " + thread)
'
