#!/usr/bin/env bash
# Orca automation precheck for the Axstack PR driver (spec rev 32304f4). No model, bounded, read-only on GitHub.
# Exit 0 = run the driver (allowlisted change or due control work). Any other exit = skip this tick.
#   1 unchanged   2 gh/tooling error   3 previous driver run still active
set -u
RUN_DIR="/root/dev/axstack/.git/axstack/runs/20260916-pr-automations"
ALLOWLIST='["axatbhardwaj/axstack"]'   # mutation allowlist, mirrored verbatim in the automation prompt
LIMIT=100
LOG="$RUN_DIR/precheck.log"; CUR="$RUN_DIR/cursor.json"; PENDING="$RUN_DIR/pending.json"
mkdir -p "$RUN_DIR"
ts="$(date -u +%FT%TZ)"
log() { printf '%s %s\n' "$ts" "$1" >> "$LOG"; }

# Terminal hygiene and the real busy guard. Orca does not reuse the driver session on this host (verified
# 2026-09-16: scheduled runs 7 and 8 each opened a new terminal), so every changed tick starts a fresh
# session that reconciles from the run record. Before dispatching, close the previous ticks' idle driver
# terminals; a driver terminal that is still working means the tick is busy.
#
# Only driver terminals are in scope. The watchdog is a separate automation dispatched on the same minute,
# and a session that is still booting reports tui-idle, so sweeping its terminals closed it seconds after
# launch (verified 2026-09-16: watchdog runs 8-10 dispatched and wrote nothing). The watchdog owns its own
# terminals; a busy watchdog is also not this tick being busy.
# Closing needs --tab: without it the pane is closed but the session stays listed and is never reclaimed.
if command -v orca >/dev/null 2>&1; then
  handles="$(orca terminal list --json 2>/dev/null \
    | jq -r '.result.terminals[]? | select(.agentIdentity == "claude") | select((.title // "") | test("Axstack PR (automation )?driver")) | .handle')"
  for h in $handles; do
    if orca terminal wait --terminal "$h" --for tui-idle --timeout-ms 3000 --json 2>/dev/null | jq -e '.result.wait.satisfied == true' >/dev/null 2>&1; then
      orca terminal close --terminal "$h" --tab --json >/dev/null 2>&1 || true
    else
      log busy; exit 3
    fi
  done
fi

me="$(gh api user --jq .login 2>/dev/null)" || { log error; exit 2; }
[ -n "$me" ] || { log error; exit 2; }
fields='url,number,repository,updatedAt'
search() { # $1 = flag; a result count equal to the limit is a detectable truncation
  local out; out="$(gh search prs --state open "$1" "$me" --json "$fields" --limit "$LIMIT" 2>/dev/null)" || return 1
  [ "$(printf '%s' "$out" | jq 'length')" -lt "$LIMIT" ] || return 1
  printf '%s' "$out"
}
own="$(search --author)" || { log error; exit 2; }
req="$(search --review-requested)" || { log error; exit 2; }
men="$(search --mentions)" || { log error; exit 2; }

cursor="$( [ -f "$CUR" ] && cat "$CUR" 2>/dev/null || echo '{}')"
expired="$(printf '%s' "$cursor" | jq -c '.expired // []')"

# Full discovery list (all repos, deduplicated by URL, own-PR precedence) — recorded, never hashed for external repos.
discovery="$(jq -cn --argjson own "$own" --argjson req "$req" --argjson men "$men" --argjson allow "$ALLOWLIST" '
  ([$own[] | {url, number, repo: .repository.nameWithOwner, updatedAt, kind: "own"}]
   + [$req[] | {url, number, repo: .repository.nameWithOwner, updatedAt, kind: "review_requested"}]
   + [$men[] | {url, number, repo: .repository.nameWithOwner, updatedAt, kind: "mention"}])
  | group_by(.url)
  | map(sort_by(if .kind=="own" then 0 elif .kind=="review_requested" then 1 else 2 end)
        | {url: .[0].url, number: .[0].number, repo: .[0].repo, updatedAt: (map(.updatedAt)|max),
           kinds: (map(.kind)|unique), allowlisted: ([.[0].repo] | inside($allow))})
  | sort_by(.url)')" || { log error; exit 2; }

# Allowlisted, non-expired PRs enter the hash; own PRs also carry head, base and check rollup (check state is data).
hashed="$(printf '%s' "$discovery" | jq -c --argjson expired "$expired" '[ .[] | select(.allowlisted and (([.url] | inside($expired)) | not)) ]')" || { log error; exit 2; }
own_full='[]'
while IFS=$'\t' read -r repo number url; do
  [ -n "$repo" ] || continue
  detail="$(gh pr view "$number" --repo "$repo" --json headRefOid,baseRefName,statusCheckRollup 2>/dev/null)" || { log error; exit 2; }
  base_ref="$(printf '%s' "$detail" | jq -r '.baseRefName')"
  base_sha="$(gh api "repos/$repo/commits/$base_ref" --jq .sha 2>/dev/null)" || { log error; exit 2; }
  entry="$(printf '%s' "$detail" | jq -c --arg url "$url" --arg base "$base_sha" '{url: $url, head: .headRefOid, base: $base,
    checks: ([.statusCheckRollup[]? | (.conclusion // .state // "")] | sort)}')" || { log error; exit 2; }
  own_full="$(printf '%s' "$own_full" | jq -c --argjson e "$entry" '. + [$e]')"
done < <(printf '%s' "$hashed" | jq -r '.[] | select(.kinds | index("own")) | [.repo, .number, .url] | @tsv')

payload="$(jq -cn --arg me "$me" --argjson hashed "$hashed" --argjson heads "$own_full" '{me: $me, prs: $hashed, own_heads: ($heads | sort_by(.url))}')" || { log error; exit 2; }
fp="$(printf '%s' "$payload" | sha256sum | cut -d' ' -f1)"
prev="$(printf '%s' "$cursor" | jq -r '.fingerprint // ""')"

# Due control work: a stored watch deadline at or before now, or a pending failed-relay retry.
due="$(printf '%s' "$cursor" | jq -r --arg now "$ts" '
  ([.deadlines // {} | to_entries[] | select(.value <= $now) | .key] + [.retries // [] | .[] | .id]) | length')"

printf '%s' "$discovery" | jq --arg fp "$fp" --arg ts "$ts" --argjson payload "$payload" \
  '{fingerprint: $fp, observed_at: $ts, payload: $payload, discovery: .}' > "$PENDING"

if [ "$fp" != "$prev" ]; then log changed; exit 0; fi
if [ "${due:-0}" -gt 0 ]; then log due; exit 0; fi
log unchanged; exit 1
