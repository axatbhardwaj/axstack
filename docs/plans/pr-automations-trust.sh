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

# Claude's lock: bounded wait, never broken. Only a successful mkdir proves we hold it — a lock that
# already exists belongs to someone else no matter who owns it or how fresh it is. Claude's
# proper-lockfile treats a lock older than 10 s as stale and may replace it; our hold is one jq call
# (milliseconds) and the mtime is refreshed at acquisition, and the release compares the directory's
# inode so a lock that was stolen and recreated is never removed by us.
got=0
for _ in $(seq 1 25); do if mkdir "$LOCK" 2>/dev/null; then got=1; break; fi; sleep 0.2; done
[ "$got" -eq 1 ] || exit 2
touch "$LOCK" 2>/dev/null
ino="$(stat -c %i "$LOCK" 2>/dev/null)"
trap '[ "$(stat -c %i "$LOCK" 2>/dev/null)" = "$ino" ] && rmdir "$LOCK" 2>/dev/null' EXIT

# Re-read under the lock; a store that does not parse is never rewritten.
jq -e . "$STORE" >/dev/null 2>&1 || exit 2
t="$STORE.tmp.$$.$RANDOM"
if jq --arg p "$wt_c" "$filter" "$STORE" > "$t" 2>/dev/null; then
  chmod --reference="$STORE" "$t" 2>/dev/null
  mv -f "$t" "$STORE"
else
  rm -f "$t"; exit 2
fi
exit 0
