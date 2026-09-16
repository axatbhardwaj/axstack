#!/usr/bin/env bash
set -uo pipefail

RUN_DIR="${RUN_DIR:-}"
DRIVER_AUTOMATION_ID="${DRIVER_AUTOMATION_ID:-}"

while (( $# )); do
  case "$1" in
    --run-dir)
      (( $# >= 2 )) || { printf '%s requires a value\n' "$1" >&2; exit 1; }
      RUN_DIR="$2"; shift 2
      ;;
    --driver-automation-id)
      (( $# >= 2 )) || { printf '%s requires a value\n' "$1" >&2; exit 1; }
      DRIVER_AUTOMATION_ID="$2"; shift 2
      ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 1 ;;
  esac
done

if [[ -z "$RUN_DIR" || -z "$DRIVER_AUTOMATION_ID" ]]; then
  printf 'RUN_DIR and DRIVER_AUTOMATION_ID are required\n' >&2
  exit 1
fi

# This sidecar is the watchdog's last state. It preserves active occurrence
# first_observed values and delivery receipts; watchdog.log remains one JSON
# line per tick and is never rewritten.
state_file="$RUN_DIR/watchdog-state.json"
log_file="$RUN_DIR/watchdog.log"
now="$(date -u +'%Y-%m-%dT%H:%M:%S.%NZ')"
now_epoch="$(date -u +%s)"
checks='{}'

put_check() {
  local name="$1" status="$2" reason="$3"
  checks="$(jq -c --arg name "$name" --arg status "$status" --arg reason "$reason" \
    '.[$name] = {status: $status, reason: $reason}' <<<"$checks")"
}

cursor_ok=false
cursor=''
if [[ -r "$RUN_DIR/cursor.json" ]]; then
  cursor="$(jq -ce 'if type == "object" then . else error("cursor must be an object") end' \
    "$RUN_DIR/cursor.json" 2>/dev/null)" && cursor_ok=true
fi

precheck_ok=false
precheck='[]'
if [[ -r "$RUN_DIR/precheck.log" ]]; then
  precheck="$(jq -Rsc '
    (split("\n") | map(select(length > 0))) as $lines |
    [$lines[] | capture("^(?<ts>[^ ]+) (?<outcome>changed|due|unchanged|running|error)$")] as $parsed |
    if ($parsed | length) == ($lines | length) then $parsed
    else error("malformed precheck line") end
  ' "$RUN_DIR/precheck.log" 2>/dev/null)" && precheck_ok=true
fi

orca_ok=false
orca_runs="$(orca automations runs --id "$DRIVER_AUTOMATION_ID" --json 2>/dev/null)"
if [[ $? -eq 0 ]] && jq -e '.result.runs | type == "array"' >/dev/null 2>&1 <<<"$orca_runs"; then
  orca_ok=true
fi

if ! $cursor_ok || ! $precheck_ok || ! $orca_ok; then
  put_check driver_stuck unknown 'cursor, precheck, or Orca run evidence unreadable'
else
  due_ts="$(jq -r '[.[] | select(.outcome == "changed" or .outcome == "due")] | last | .ts // empty' <<<"$precheck")"
  done_ts="$(jq -r '.tick_done_at // empty' <<<"$cursor")"
  due_epoch=''
  done_epoch=''
  [[ -z "$due_ts" ]] || due_epoch="$(date -u -d "$due_ts" +%s 2>/dev/null)"
  [[ -z "$done_ts" ]] || done_epoch="$(date -u -d "$done_ts" +%s 2>/dev/null)"
  if [[ -n "$due_ts" && -z "$due_epoch" ]] || [[ -n "$done_ts" && -z "$done_epoch" ]]; then
    put_check driver_stuck unknown 'driver timestamp unreadable'
  elif [[ -n "$due_epoch" && $((now_epoch - due_epoch)) -gt 3600 \
      && ( -z "$done_epoch" || "$done_epoch" -le "$due_epoch" ) ]]; then
    put_check driver_stuck trip "precheck work at $due_ts has no later tick_done_at"
  else
    put_check driver_stuck ok 'no overdue uncompleted changed or due precheck'
  fi
fi

if ! $precheck_ok; then
  put_check precheck_failing unknown 'precheck log unreadable'
elif [[ "$(jq -r 'length >= 3 and (.[-3:] | all(.outcome == "error"))' <<<"$precheck")" == true ]]; then
  put_check precheck_failing trip 'last three precheck lines are error'
else
  put_check precheck_failing ok 'last three precheck lines are not all error'
fi

if ! $cursor_ok; then
  put_check worker_stuck unknown 'cursor unreadable'
else
  markers="$(jq -ce '
    (.dispatch_markers // {}) as $markers |
    if ($markers | type) == "array" then $markers
    elif ($markers | type) == "object" then [$markers[]]
    else error("dispatch_markers must be an object or array") end |
    map(if (.started_at | type) == "string" then . else error("missing started_at") end)
  ' <<<"$cursor" 2>/dev/null)"
  if [[ $? -ne 0 ]]; then
    put_check worker_stuck unknown 'dispatch marker evidence unreadable'
  else
    stuck=false
    while IFS= read -r started_at; do
      started_epoch="$(date -u -d "$started_at" +%s 2>/dev/null)"
      if [[ -z "$started_epoch" ]]; then
        put_check worker_stuck unknown 'dispatch marker timestamp unreadable'
        stuck=unknown
        break
      elif (( now_epoch - started_epoch > 12600 )); then
        stuck=true
      fi
    done < <(jq -r '.[].started_at' <<<"$markers")
    if [[ "$stuck" == true ]]; then
      put_check worker_stuck trip 'a dispatch marker is older than 3h30m'
    elif [[ "$stuck" == false ]]; then
      put_check worker_stuck ok 'no dispatch marker is older than 3h30m'
    fi
  fi
fi

decision_status=ok
decision_reason='no open decision is older than 24h'
if [[ ! -d "$RUN_DIR/decisions" || ! -r "$RUN_DIR/decisions" ]]; then
  decision_status=unknown
  decision_reason='decisions directory unreadable'
else
  shopt -s nullglob
  for decision_file in "$RUN_DIR"/decisions/*.json; do
    decision="$(jq -ce . "$decision_file" 2>/dev/null)"
    if [[ $? -ne 0 ]] || [[ "$(jq -r '.state | type' <<<"$decision")" != string ]]; then
      decision_status=unknown
      decision_reason='decision evidence unreadable'
      break
    fi
    if [[ "$(jq -r '.state' <<<"$decision")" == open ]]; then
      created_at="$(jq -r '.created_at // empty' <<<"$decision")"
      created_epoch="$(date -u -d "$created_at" +%s 2>/dev/null)"
      if [[ -z "$created_epoch" ]]; then
        decision_status=unknown
        decision_reason='open decision timestamp unreadable'
        break
      elif (( now_epoch - created_epoch > 86400 )); then
        decision_status=trip
        decision_reason='an open decision is older than 24h'
      fi
    fi
  done
fi
put_check decision_waiting "$decision_status" "$decision_reason"

state='{"occurrences":{}}'
state_ok=true
if [[ -e "$state_file" ]]; then
  loaded_state="$(jq -ce '.occurrences | type == "object"' "$state_file" 2>/dev/null)"
  if [[ "$loaded_state" == true ]]; then
    state="$(jq -c . "$state_file")"
  else
    # The prior delivery state cannot be reconciled, so preserve uncertainty
    # and do not risk duplicating a message.
    state_ok=false
  fi
fi

for name in driver_stuck precheck_failing worker_stuck decision_waiting; do
  status="$(jq -r --arg name "$name" '.[$name].status' <<<"$checks")"
  reason="$(jq -r --arg name "$name" '.[$name].reason' <<<"$checks")"
  if [[ "$status" == ok ]]; then
    state="$(jq -c --arg name "$name" 'del(.occurrences[$name])' <<<"$state")"
  elif [[ "$(jq -r --arg name "$name" '.occurrences[$name] != null' <<<"$state")" == true ]]; then
    state="$(jq -c --arg name "$name" --arg status "$status" --arg reason "$reason" \
      '.occurrences[$name] += {status: $status, reason: $reason}' <<<"$state")"
  else
    state="$(jq -c --arg name "$name" --arg first "$now" --arg status "$status" --arg reason "$reason" \
      '.occurrences[$name] = {check: $name, first_observed: $first, status: $status, reason: $reason}' <<<"$state")"
    if ! $state_ok; then
      state="$(jq -c --arg name "$name" \
        '.occurrences[$name].send = {check: $name, status: "uncertain", message_id: null}' <<<"$state")"
    fi
  fi
done

sent='[]'
for name in driver_stuck precheck_failing worker_stuck decision_waiting; do
  active="$(jq -r --arg name "$name" '.occurrences[$name] != null' <<<"$state")"
  [[ "$active" == true ]] || continue
  prior="$(jq -r --arg name "$name" '.occurrences[$name].send.status // empty' <<<"$state")"
  [[ -z "$prior" || "$prior" == failed ]] || continue
  message="$(jq -r --arg name "$name" '.occurrences[$name] |
    "Axstack automation watchdog: \(.check) \(.status) since \(.first_observed): \(.reason)"' <<<"$state")"
  receipt_json="$(hermes send --to telegram --json "$message" 2>/dev/null)"
  receipt_rc=$?
  message_id="$(jq -r '.message_id // .result.message_id // empty' <<<"$receipt_json" 2>/dev/null)"
  if (( receipt_rc != 0 )); then
    receipt_status=failed
  elif [[ -z "$message_id" ]]; then
    receipt_status=uncertain
  else
    receipt_status=sent
  fi
  receipt="$(jq -nc --arg check "$name" --arg status "$receipt_status" --arg message_id "$message_id" \
    '{check: $check, status: $status, message_id: (if $message_id == "" then null else $message_id end)}')"
  state="$(jq -c --arg name "$name" --argjson receipt "$receipt" \
    '.occurrences[$name].send = $receipt' <<<"$state")"
  sent="$(jq -c --argjson receipt "$receipt" '. + [$receipt]' <<<"$sent")"
done

tmp_state="$state_file.tmp.$$"
printf '%s\n' "$state" >"$tmp_state" && mv "$tmp_state" "$state_file"

for name in driver_stuck precheck_failing worker_stuck decision_waiting; do
  send="$(jq -c --arg name "$name" '.occurrences[$name].send // null' <<<"$state")"
  checks="$(jq -c --arg name "$name" --argjson send "$send" '.[$name].send = $send' <<<"$checks")"
done
trips="$(jq -c '[.occurrences[]]' <<<"$state")"
jq -nc --arg ts "$now" --argjson checks "$checks" --argjson trips "$trips" --argjson sent "$sent" \
  '{ts: $ts, checks: $checks, trips: $trips, sent: $sent}' >>"$log_file"

# A non-zero precheck result prevents Orca from launching a model session.
exit 1
