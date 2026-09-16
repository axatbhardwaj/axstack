#!/usr/bin/env bash
# Orca automation precheck for the Axstack defi-com PR driver, Automation C (spec rev 5). No model, bounded, read-only on GitHub.
# Exit 0 = run the driver (change in either list, or due control work). Any other exit = skip this tick.
#   1 unchanged   2 gh/tooling error   3 previous driver run still active
set -u
RUN_DIR="/root/dev/axstack/.git/axstack/runs/20260916-defi-automations"
AUTOMATION_ID="ca84e9c0-c0a6-4f42-8b62-9be619994c4f"   # this driver automation; terminal ownership comes from its run history
# Two lists, per revision 5. Each action reads its own; discovery and the hash use the union.
REVIEW_ALLOW='["defi-com/monorepo","defi-com/mobile","defi-com/azure-next-hybrid"]'
REPAIR_ALLOW='["defi-com/monorepo","defi-com/mobile"]'
LIMIT=100
LOG="$RUN_DIR/precheck.log"; CUR="$RUN_DIR/cursor.json"; PENDING="$RUN_DIR/pending.json"
mkdir -p "$RUN_DIR"
ts="$(date -u +%FT%TZ)"
log() { printf '%s %s\n' "$ts" "$1" >> "$LOG"; }

# Terminal hygiene and the busy guard, by this automation's own recorded terminalPtyId, never by title.
if command -v orca >/dev/null 2>&1; then
  own_ptys="$(orca automations runs --id "$AUTOMATION_ID" --json 2>/dev/null \
    | jq -c '[.result.runs[]? | .terminalPtyId // empty]')" || { log error; exit 2; }
  [ -n "$own_ptys" ] || { log error; exit 2; }
  handles="$(orca terminal list --json 2>/dev/null \
    | jq -r --argjson ptys "$own_ptys" '.result.terminals[]? | select((.ptyId // "") as $p | $ptys | index($p)) | .handle')"
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
search() { # a result count equal to the limit is a detectable truncation
  local out; out="$(gh search prs --state open "$1" "$me" --json "$fields" --limit "$LIMIT" 2>/dev/null)" || return 1
  [ "$(printf '%s' "$out" | jq 'length')" -lt "$LIMIT" ] || return 1
  printf '%s' "$out"
}
own="$(search --author)" || { log error; exit 2; }
req="$(search --review-requested)" || { log error; exit 2; }
men="$(search --mentions)" || { log error; exit 2; }

cursor="$( [ -f "$CUR" ] && cat "$CUR" 2>/dev/null || echo '{}')"

# Full discovery list, deduplicated by URL with own-PR precedence. Pair C/D has no expired state.
discovery="$(jq -cn --argjson own "$own" --argjson req "$req" --argjson men "$men" \
  --argjson review "$REVIEW_ALLOW" --argjson repair "$REPAIR_ALLOW" '
  ([$own[] | {url, number, repo: .repository.nameWithOwner, updatedAt, kind: "own"}]
   + [$req[] | {url, number, repo: .repository.nameWithOwner, updatedAt, kind: "review_requested"}]
   + [$men[] | {url, number, repo: .repository.nameWithOwner, updatedAt, kind: "mention"}])
  | group_by(.url)
  | map(sort_by(if .kind=="own" then 0 elif .kind=="review_requested" then 1 else 2 end)
        | {url: .[0].url, number: .[0].number, repo: .[0].repo, updatedAt: (map(.updatedAt)|max),
           kinds: (map(.kind)|unique),
           reviewable: ([.[0].repo] | inside($review)),
           repairable: ([.[0].repo] | inside($repair))})
  | sort_by(.url)')" || { log error; exit 2; }

# The union of the two lists enters the hash. An own PR in a review-only repo has no available action,
# so it is recorded but never hashed: it must not wake C.
hashed="$(printf '%s' "$discovery" | jq -c '[ .[] |
  select( (.repairable and (.kinds | index("own")))
          or (.reviewable and ((.kinds | index("review_requested")) or (.kinds | index("mention")))) ) ]')" \
  || { log error; exit 2; }

# Own PRs that are actually repairable carry head, base, draft status and the check rollup.
own_full='[]'
while IFS=$'\t' read -r repo number url; do
  [ -n "$repo" ] || continue
  detail="$(gh pr view "$number" --repo "$repo" --json headRefOid,baseRefName,isDraft,statusCheckRollup 2>/dev/null)" || { log error; exit 2; }
  base_ref="$(printf '%s' "$detail" | jq -r '.baseRefName')"
  base_sha="$(gh api "repos/$repo/commits/$base_ref" --jq .sha 2>/dev/null)" || { log error; exit 2; }
  entry="$(printf '%s' "$detail" | jq -c --arg url "$url" --arg base "$base_sha" '{url: $url, head: .headRefOid, base: $base,
    draft: .isDraft, checks: ([.statusCheckRollup[]? | (.conclusion // .state // "")] | sort)}')" || { log error; exit 2; }
  own_full="$(printf '%s' "$own_full" | jq -c --argjson e "$entry" '. + [$e]')"
done < <(printf '%s' "$hashed" | jq -r '.[] | select(.repairable and (.kinds | index("own"))) | [.repo, .number, .url] | @tsv')

payload="$(jq -cn --arg me "$me" --argjson hashed "$hashed" --argjson heads "$own_full" '{me: $me, prs: $hashed, own_heads: ($heads | sort_by(.url))}')" || { log error; exit 2; }
fp="$(printf '%s' "$payload" | sha256sum | cut -d' ' -f1)"
prev="$(printf '%s' "$cursor" | jq -r '.fingerprint // ""')"

# Due control work for pair C/D: an outstanding blocking-review obligation, an expired per-PR repair cap,
# or a pending failed-relay retry. No watch deadlines — the rolling window has no expiry.
due="$(printf '%s' "$cursor" | jq -r --arg now "$ts" '
  ([.obligations // [] | .[] | (.url // .pr)]
   + [(.repair_caps // .caps // {}) | to_entries[] | select((.value | if type=="object" then .expires_at else . end) <= $now) | .key]
   + [(.pending_relay_retries // .retries // []) | .[] | (.id // .message_id // "retry")]) | length')"

printf '%s' "$discovery" | jq --arg fp "$fp" --arg ts "$ts" --argjson payload "$payload" \
  '{fingerprint: $fp, observed_at: $ts, payload: $payload, discovery: .}' > "$PENDING"

if [ "$fp" != "$prev" ]; then log changed; exit 0; fi
if [ "${due:-0}" -gt 0 ]; then log due; exit 0; fi
log unchanged; exit 1
