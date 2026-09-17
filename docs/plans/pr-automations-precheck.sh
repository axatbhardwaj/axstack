#!/usr/bin/env bash
set -u

# Model-free discovery precheck for the rev-3 defi-com PR driver.
# Exit 0 = changed or due, 1 = unchanged, 2 = error, 3 = tick still running.
RUN_DIR="${1:-${RUN_DIR:-}}"
REVIEW_ALLOW='["defi-com/monorepo","defi-com/mobile","defi-com/azure-next-hybrid","defi-com/ci-workflows"]'
REPAIR_ALLOW='["defi-com/monorepo","defi-com/mobile"]'
LIMIT=100
FIELDS='url,number,repository,updatedAt'

[ -n "$RUN_DIR" ] || { printf 'RUN_DIR is required\n' >&2; exit 2; }
mkdir -p "$RUN_DIR"
LOG="$RUN_DIR/precheck.log"
CURSOR_FILE="$RUN_DIR/cursor.json"
PENDING_FILE="$RUN_DIR/pending.json"
DECISIONS_DIR="$RUN_DIR/decisions"
timestamp="$(date -u +%FT%TZ)"

log() { printf '%s %s\n' "$timestamp" "$1" >> "$LOG"; }
fail() { log error; exit 2; }

cursor='{}'
if [ -f "$CURSOR_FILE" ]; then
  cursor="$(cat "$CURSOR_FILE" 2>/dev/null)" || fail
  printf '%s' "$cursor" | jq -e . >/dev/null 2>&1 || fail
fi

# These are the only timestamp-bearing cursor fields read by the precheck.
# Reject malformed state rather than silently treating it as not due.
printf '%s' "$cursor" | jq -e '
  def timestamp:
    type == "string"
    and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?Z$")
    and (try (sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601 | true) catch false);
  ((has("tick_started_at") | not) or (.tick_started_at | timestamp))
  and ((has("tick_done_at") | not) or (.tick_done_at | timestamp))
  and ((.dispatch_markers // []) | type == "array"
    and all(.[]; .started_at | timestamp))
  and ((.repair_caps // {}) | type == "object"
    and all(.[]; .expires_at | timestamp))
  and ((.runtime_refusal // null) == null
    or (.runtime_refusal | type == "object"
      and (.code | type == "string" and length > 0)
      and (.first_seen | timestamp)
      and (.last_seen | timestamp)))
' >/dev/null 2>&1 || fail

# A recent unfinished tick is the only overlap signal. This precheck never
# calls Orca and never inspects terminal state.
if printf '%s' "$cursor" | jq -e --arg now "$timestamp" '
  def epoch: sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601;
  (try (.tick_started_at | epoch) catch null) as $started
  | (try (.tick_done_at | epoch) catch null) as $done
  | (try ($now | fromdateiso8601) catch null) as $now_epoch
  | $started != null and $now_epoch != null
    and $started > ($done // 0) and ($now_epoch - $started) < 3600
' >/dev/null 2>&1; then
  log running
  exit 3
fi

me="$(gh api user --jq .login 2>/dev/null)" || fail
[ -n "$me" ] || fail

search() {
  local output
  output="$(gh search prs --state open --limit "$LIMIT" --json "$FIELDS" "$@" 2>/dev/null)" || return 1
  printf '%s' "$output" | jq -e --argjson limit "$LIMIT" \
    'type == "array" and length < $limit' >/dev/null 2>&1 || return 1
  printf '%s' "$output"
}

own="$(search --author @me)" || fail
requested="$(search --review-requested @me)" || fail
mentioned="$(search --mentions @me)" || fail
reviewed="$(search --reviewed-by @me --review changes_requested)" || fail

# Search order establishes own-PR precedence. Kinds are retained because the
# driver needs the full discovery provenance even though the hash is narrower.
discovery="$(jq -cn \
  --argjson own "$own" --argjson requested "$requested" \
  --argjson mentioned "$mentioned" --argjson reviewed "$reviewed" \
  --argjson review_allow "$REVIEW_ALLOW" --argjson repair_allow "$REPAIR_ALLOW" '
  def rows($items; $kind; $rank):
    $items[] | {
      url, number, repo: .repository.nameWithOwner, updatedAt,
      kind: $kind, rank: $rank
    };
  ([rows($own; "own"; 0)]
   + [rows($requested; "review_requested"; 1)]
   + [rows($mentioned; "mention"; 2)]
   + [rows($reviewed; "changes_requested"; 3)])
  | sort_by(.url, .rank)
  | group_by(.url)
  | map(.[0] as $first | {
      url: $first.url,
      number: $first.number,
      repo: $first.repo,
      updatedAt: (map(.updatedAt) | max),
      kinds: (map(.kind) | unique)
    })
  | map(.repo as $repo
      | select((($review_allow + $repair_allow) | unique | index($repo)) != null))
  | sort_by(.url)
')" || fail

enriched='[]'
while IFS=$'\t' read -r repo number; do
  [ -n "$repo" ] || continue
  detail="$(gh pr view "$number" --repo "$repo" \
    --json headRefOid,baseRefName,isDraft,statusCheckRollup,author,latestReviews 2>/dev/null)" || fail
  printf '%s' "$detail" | jq -e '
    .headRefOid and .baseRefName and (.isDraft | type == "boolean")
    and (.statusCheckRollup | type == "array")
    and (.latestReviews | type == "array") and .author.login
  ' >/dev/null 2>&1 || fail
  base_ref="$(printf '%s' "$detail" | jq -r '.baseRefName')" || fail
  base_sha="$(gh api "repos/$repo/commits/$base_ref" --jq .sha 2>/dev/null)" || fail
  [ -n "$base_sha" ] || fail
  enriched="$(jq -cn --argjson list "$enriched" --argjson all "$discovery" \
    --arg repo "$repo" --argjson number "$number" --argjson detail "$detail" --arg base "$base_sha" '
    ($all[] | select(.repo == $repo and .number == $number)) as $item
    | $list + [$item + {
        head: $detail.headRefOid,
        base: $base,
        baseRefName: $detail.baseRefName,
        draft: $detail.isDraft,
        checks: ($detail.statusCheckRollup
          | map({name: (.name // .context)}
            + if .conclusion != null then {conclusion} else {state} end)
          | sort_by(.name, .conclusion // .state)),
        reviews: ($detail.latestReviews
          | map(select(.commit.oid == $detail.headRefOid) | {id, state})
          | sort_by(.id, .state)),
        author: $detail.author.login
      }]
  ')" || fail
done < <(printf '%s' "$discovery" | jq -r '.[] | [.repo, .number] | @tsv')
discovery="$enriched"

previous_seen='[]'
if [ -f "$PENDING_FILE" ]; then
  previous_seen="$(jq -ce '.seen // [] | if type == "array" then . else error("invalid seen") end' \
    "$PENDING_FILE" 2>/dev/null)" || fail
fi

seen="$(printf '%s' "$discovery" | jq -c '[
  .[] | select((.kinds | index("own")) == null) | {url, head}
] | sort_by(.url, .head)')" || fail

hashed="$(jq -cn --argjson discovery "$discovery" --argjson previous "$previous_seen" '
  [$discovery[]
   | ((.kinds | index("own")) != null) as $own
   | select($own or ((.url + "\u0000" + .head) as $key
       | [$previous[] | .url + "\u0000" + .head] | index($key) != null))
   | if $own then {url, head, base, draft, checks, reviews}
     else {url, head, base}
     end]
  | sort_by(.url)
')" || fail

fingerprint="$(printf '%s' "$hashed" | sha256sum | cut -d' ' -f1)" || fail
previous_fingerprint="$(printf '%s' "$cursor" | jq -r '.fingerprint // ""')" || fail

due=0
if [ -d "$DECISIONS_DIR" ]; then
  for decision_file in "$DECISIONS_DIR"/*.json; do
    [ -e "$decision_file" ] || continue
    decision="$(cat "$decision_file" 2>/dev/null)" || fail
    printf '%s' "$decision" | jq -e 'type == "object" and (.state | type == "string")' >/dev/null 2>&1 || fail
    if printf '%s' "$decision" | jq -e '
      ((.state == "approved" or .state == "rejected") and (.consumed_at // null) == null)
      or (.state == "spent" and (.receipt // null) == null)
    ' >/dev/null; then
      due=1
    fi
  done
fi

if jq -en --argjson cursor "$cursor" --argjson discovery "$discovery" '
  any($cursor.deferred[]?; . as $item
    | any($discovery[]; .repo == $item.repo and .number == $item.pr and .head == $item.head))
' >/dev/null; then due=1; fi

if printf '%s' "$cursor" | jq -e --arg now "$timestamp" '
  def epoch: sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601;
  ($now | epoch) as $now_epoch
  | any((.repair_caps // {} | .[]); (.expires_at | epoch) <= $now_epoch)
' >/dev/null; then due=1; fi

if printf '%s' "$cursor" | jq -e --arg now "$timestamp" '
  def epoch: sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601;
  ($now | fromdateiso8601) as $now_epoch
  | any((.dispatch_markers // [] | .[]);
      (.started_at | epoch) < ($now_epoch - 10800))
' >/dev/null; then due=1; fi

if printf '%s' "$cursor" | jq -e '(.pending_settlement // []) | length > 0' >/dev/null; then due=1; fi

# A runtime-refusal hold is re-tested by re-attempting the refused operation, which needs a launched
# tick; while the record is present the tick is due even when GitHub is unchanged.
if printf '%s' "$cursor" | jq -e '(.runtime_refusal // null) != null' >/dev/null; then due=1; fi

pending_tmp="$PENDING_FILE.tmp.$$"
jq -cn --arg fingerprint "$fingerprint" --arg observed_at "$timestamp" \
  --argjson seen "$seen" --argjson discovery "$discovery" --argjson hashed "$hashed" \
  '{fingerprint: $fingerprint, observed_at: $observed_at, seen: $seen,
    discovery: $discovery, hashed: $hashed}' > "$pending_tmp" || { rm -f "$pending_tmp"; fail; }
mv "$pending_tmp" "$PENDING_FILE" || { rm -f "$pending_tmp"; fail; }

if [ "$fingerprint" != "$previous_fingerprint" ]; then log changed; exit 0; fi
if [ "$due" -eq 1 ]; then log due; exit 0; fi
log unchanged
exit 1
