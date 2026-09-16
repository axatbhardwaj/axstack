#!/usr/bin/env bash

set -u

if [[ $# -ne 2 || ! $1 =~ ^[0-9a-f]{24,}$ || ! $2 =~ ^(approve|reject)$ ]]; then
  exit 2
fi

token=$1
verb=$2
expected_user_id=${AXSTACK_DECISION_USER_ID:-}
config_path=${AXSTACK_HERMES_CONFIG:-${HOME:-}/.hermes/config.yaml}
env_path=${AXSTACK_HERMES_ENV:-${HOME:-}/.hermes/.env}

env_value() {
  local key=$1 path=$2
  awk -v wanted="$key" '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      return value
    }
    /^[[:space:]]*(#|$)/ { next }
    {
      line = $0
      sub(/^[[:space:]]*export[[:space:]]+/, "", line)
      split_at = index(line, "=")
      if (!split_at) next
      name = trim(substr(line, 1, split_at - 1))
      if (name != wanted) next
      value = trim(substr(line, split_at + 1))
      if ((substr(value, 1, 1) == "\"" && substr(value, length(value), 1) == "\"") ||
          (substr(value, 1, 1) == "\047" && substr(value, length(value), 1) == "\047")) {
        value = substr(value, 2, length(value) - 2)
      }
      print value
    }
  ' "$path" 2>/dev/null
}

home_channel_value() {
  local wanted=$1 path=$2
  awk -v wanted="$wanted" '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      return value
    }
    function scalar(value) {
      value = trim(value)
      sub(/[[:space:]]+#.*$/, "", value)
      if ((substr(value, 1, 1) == "\"" && substr(value, length(value), 1) == "\"") ||
          (substr(value, 1, 1) == "\047" && substr(value, length(value), 1) == "\047")) {
        value = substr(value, 2, length(value) - 2)
      }
      return value
    }
    /^[[:space:]]*(#|$)/ { next }
    {
      match($0, /^[ ]*/)
      indent = RLENGTH
      line = substr($0, indent + 1)
      colon = index(line, ":")
      if (!colon) next
      key = trim(substr(line, 1, colon - 1))
      value = substr(line, colon + 1)

      if (in_home && indent <= home_indent) in_home = 0
      if (in_telegram && indent <= telegram_indent) in_telegram = 0
      if (in_platforms && indent <= platforms_indent) in_platforms = 0

      if (in_home && key == wanted) print scalar(value)
      if (in_telegram && key == "home_channel" && trim(value) == "") {
        in_home = 1
        home_indent = indent
      }
      if (in_platforms && key == "telegram" && trim(value) == "") {
        in_telegram = 1
        telegram_indent = indent
      }
      if (key == "platforms" && trim(value) == "") {
        in_platforms = 1
        platforms_indent = indent
      }
    }
  ' "$path" 2>/dev/null
}

allowed_users=$(env_value TELEGRAM_ALLOWED_USERS "$env_path")
chat_id=$(home_channel_value chat_id "$config_path")
home_user_id=$(home_channel_value user_id "$config_path")

if [[ -z $expected_user_id || $allowed_users != "$expected_user_id" ||
      $chat_id != "$expected_user_id" || $home_user_id != "$expected_user_id" ]]; then
  exit 4
fi

if [[ -n ${HERMES_SESSION_USER_ID+x} && $HERMES_SESSION_USER_ID != "$expected_user_id" ]] ||
   [[ -n ${HERMES_SESSION_CHAT_ID+x} && $HERMES_SESSION_CHAT_ID != "$expected_user_id" ]]; then
  exit 4
fi

run_dir=${AXSTACK_RUN_DIR:-}
if [[ -z $run_dir ]]; then
  exit 3
fi

decision_file=$run_dir/decisions/$token.json
if [[ ! -f $decision_file ]]; then
  exit 3
fi

{ exec {lock_fd}>"$decision_file.lock"; } 2>/dev/null || exit 3
flock -x "$lock_fd" 2>/dev/null || exit 3

state=$(jq -er '.state | select(type == "string")' "$decision_file" 2>/dev/null) || exit 3
if [[ $state != open ]]; then
  exit 3
fi

decided_state=${verb/approve/approved}
decided_state=${decided_state/reject/rejected}
decided_at=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
tmp_file=$(mktemp "$decision_file.tmp.XXXXXX" 2>/dev/null) || exit 3
trap 'rm -f -- "$tmp_file"' EXIT

if [[ -n ${HERMES_SESSION_MESSAGE_ID+x} ]]; then
  jq --arg state "$decided_state" \
     --arg at "$decided_at" \
     --arg message_id "$HERMES_SESSION_MESSAGE_ID" \
     '.state = $state | .decided_at = $at | .decided_message_id = $message_id' \
     "$decision_file" >"$tmp_file" 2>/dev/null || exit 3
else
  jq --arg state "$decided_state" \
     --arg at "$decided_at" \
     '.state = $state | .decided_at = $at' \
     "$decision_file" >"$tmp_file" 2>/dev/null || exit 3
fi

mv -f -- "$tmp_file" "$decision_file" 2>/dev/null || exit 3
trap - EXIT
printf 'decided %s %s\n' "$token" "$decided_state"
