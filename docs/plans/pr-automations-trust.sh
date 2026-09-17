#!/usr/bin/env bash
# Trust transaction for the PR driver: the only write the automation makes to Claude Code's config store.
#   seed   <worktree path> <clone path> <head sha>   trust a worktree this tick created from an allowlisted clone
#   unseed <worktree path>                            remove that trust on cleanup
# Exit 0 done · 2 store busy or unreadable (retain the worktree, dispatch nothing) · 3 scope refused (never seed).
# Claude Code trusts per git toplevel and protects ~/.claude.json with a mkdir-based `<store>.lock`
# directory; this takes that same lock so the write coordinates with Claude's own, never forces a held
# lock, re-reads under it, writes a unique temp file, preserves the store's mode, and always releases.
set -u
STORE="${CLAUDE_TRUST_STORE:-$HOME/.claude.json}"
LOCK="$STORE.lock"
mode="${1:-}"; wt="${2:-}"

canon() { realpath -e -- "$1" 2>/dev/null; }

case "$mode" in
  seed)
    clone="${3:-}"; head="${4:-}"
    # Scope is enforced here, not by prose: the path must be a git worktree whose common dir is the
    # allowlisted clone's, must not be the clone itself, and must sit at exactly the pinned head.
    wt_c="$(canon "$wt")" || exit 3
    clone_c="$(canon "$clone")" || exit 3
    [ -n "$wt_c" ] && [ -n "$clone_c" ] && [ "$wt_c" != "$clone_c" ] || exit 3
    printf '%s' "$head" | grep -qE '^[0-9a-f]{40}$' || exit 3
    common="$(git -C "$wt_c" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || exit 3
    [ "$(canon "$common")" = "$(canon "$clone_c/.git")" ] || exit 3
    [ "$(git -C "$wt_c" rev-parse HEAD 2>/dev/null)" = "$head" ] || exit 3
    filter='.projects[$p] = ((.projects[$p] // {}) + {hasTrustDialogAccepted: true})'
    ;;
  unseed)
    wt_c="$(canon "$wt")" || wt_c="$wt"   # the directory is usually gone by now; the key is the string
    filter='del(.projects[$p])'
    ;;
  *) printf 'usage: seed <worktree> <clone> <head> | unseed <worktree>\n' >&2; exit 2 ;;
esac

# Claude's lock, with Claude's own lease rules (proper-lockfile): a lock whose mtime is older than
# STALE seconds is abandoned and may be reclaimed; a held lock is kept alive by refreshing its
# mtime; a refresh that fails is a compromised lease and the owner must not commit; the refresher
# runs with the owner and dies with it. Only a successful mkdir proves we hold the lock — an
# existing fresh lock belongs to someone else no matter who owns it. Ownership is re-verified at
# commit (unchanged inode, refresher alive, lease recently refreshed) and the release removes the
# lock only if the inode is unchanged.
STALE=10
got=0
for _ in $(seq 1 25); do
  if mkdir "$LOCK" 2>/dev/null; then got=1; break; fi
  # Reclaim only what Claude itself would treat as abandoned.
  age=$(( $(date +%s) - $(stat -c %Y "$LOCK" 2>/dev/null || date +%s) ))
  [ "$age" -ge "$STALE" ] && rmdir "$LOCK" 2>/dev/null
  sleep 0.2
done
[ "$got" -eq 1 ] || exit 2
touch "$LOCK" 2>/dev/null || { rmdir "$LOCK" 2>/dev/null; exit 2; }
ino="$(stat -c %i "$LOCK" 2>/dev/null)"
t0="$(date +%s)"
t=""
owner=$$
# Refresher: keeps the lease alive; exits when the lock is no longer ours or the owner is gone;
# a failed refresh compromises the lease and terminates the owner before it can commit.
(
  while :; do
    kill -0 "$owner" 2>/dev/null || exit 0
    [ "$(stat -c %i "$LOCK" 2>/dev/null)" = "$ino" ] || exit 0
    touch "$LOCK" 2>/dev/null || { kill -TERM "$owner" 2>/dev/null; exit 1; }
    sleep 1
  done
) &
refresher=$!
cleanup() { kill "$refresher" 2>/dev/null; wait "$refresher" 2>/dev/null; [ -n "$t" ] && rm -f "$t"; [ "$(stat -c %i "$LOCK" 2>/dev/null)" = "$ino" ] && rmdir "$LOCK" 2>/dev/null; }
trap cleanup EXIT
trap 'exit 2' INT TERM HUP

# The lease is healthy only if the lock is still ours, the refresher is alive, and it has
# refreshed within the last few seconds (well inside STALE).
still_owned() {
  [ "$(stat -c %i "$LOCK" 2>/dev/null)" = "$ino" ] \
    && kill -0 "$refresher" 2>/dev/null \
    && [ $(( $(date +%s) - $(stat -c %Y "$LOCK" 2>/dev/null || echo 0) )) -lt 3 ]
}

# Re-read under the lock; a store that does not parse is never rewritten.
jq -e . "$STORE" >/dev/null 2>&1 || exit 2
t="$STORE.tmp.$$.$RANDOM"
jq --arg p "$wt_c" "$filter" "$STORE" > "$t" 2>/dev/null || exit 2
chmod --reference="$STORE" "$t" 2>/dev/null || exit 2
# commit: only while the lease provably still holds
still_owned || exit 2
mv -f "$t" "$STORE" || exit 2
t=""
exit 0
