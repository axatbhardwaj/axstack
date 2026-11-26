set -u
set -o pipefail
export LC_ALL=C npm_config_registry=https://registry.npmjs.org
action=$1
host=$2
version=$3
global_bun=${4:-}
data=$HOME/.local/share/axstack
cli=$HOME/.local/bin/axstack
package_dir=$data/releases/$version/package

emit() { printf 'AXSTACK %s\n' "$*"; }
hold() { emit "hold $1"; exit 0; }

stable_version() {
  [[ $1 =~ ^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$ ]]
}

package_version() {
  "$bun" --no-env-file -e '
    try {
      const manifest = await Bun.file(Bun.argv[1]).json();
      if (manifest.name !== "axstack" || typeof manifest.version !== "string") process.exit(1);
      console.log(manifest.version);
    } catch (error) {
      if (error.code === "ENOENT") console.log("absent");
      else process.exit(1);
    }
  ' "$1/package.json"
}

timer() {
  local active_status=0 enabled_status=0
  active=$(systemctl --user is-active "$1.timer" 2>/dev/null) || active_status=$?
  enabled=$(systemctl --user is-enabled "$1.timer" 2>/dev/null) || enabled_status=$?
  [[ $active != active || $active_status == 0 ]] || return 1
  [[ $enabled != enabled || $enabled_status == 0 ]] || return 1
  case "$active" in active|inactive|failed|activating|deactivating) ;; *) return 1 ;; esac
  case "$enabled" in enabled|disabled|enabled-runtime|static|masked|masked-runtime|indirect|linked|linked-runtime|not-found) ;; *) return 1 ;; esac
  printf '%s %s' "$active" "$enabled"
}

skills() {
  local marker name harness
  [[ -r $package_dir/bin/axstack.js ]] || return 1
  for name in axstack axstack-implement voa; do
    [[ -s $package_dir/skills/$name/SKILL.md ]] || return 1
  done
  local -a roots=("$HOME/.agents/skills" "$HOME/.claude/skills")
  if [[ $host == io || $host == axat-vps ]]; then roots+=("$HOME/.config/opencode/skills"); fi
  for marker in "$package_dir"/skills/{axstack,axstack-*,voa}/SKILL.md; do
    if [[ ! -r $marker ]]; then
      # A glob may have no matches in an older package.
      [[ $marker == *'/axstack-*/SKILL.md' ]] && continue
      return 1
    fi
    name=${marker%/SKILL.md}
    name=${name##*/}
    for harness in "${roots[@]}"; do
      cmp -s "$marker" "$harness/$name/SKILL.md" || return 1
    done
  done
}

observe() {
  installed=absent
  if [[ -e $cli || -L $cli ]]; then
    installed=$("$cli" --version 2>/dev/null) || return 1
    [[ $installed == 'axstack '* ]] || return 1
    installed=${installed#axstack }
    stable_version "$installed" || return 1
    current=$(package_version "$data/releases/$installed/package") || return 1
    [[ $current == "$installed" ]] || return 1
  fi
  packaged=$(package_version "$package_dir") || return 1
  [[ $packaged == absent || $packaged == "$version" ]] || return 1
  default_sync=$(timer axstack-default-sync) || return 1
  single_server=$(timer axstack-single-server) || return 1
  drop_in=unknown
  if paths=$(systemctl --user show --property=DropInPaths --value axstack-default-sync.service 2>/dev/null); then
    drop_in=absent
    [[ -z $paths ]] || drop_in=present
  fi
  package_skills=absent
  if skills; then package_skills=present; fi
  global=n/a
  if [[ $host == axat-vps ]]; then
    global=$(package_version "$HOME/.bun/install/global/node_modules/axstack") || return 1
    [[ $global == absent ]] || stable_version "$global" || return 1
  fi
}

ready() {
  [[ $installed == "$version" && $packaged == "$version" && $package_skills == present &&
     $default_sync == 'active enabled' && $single_server == 'active enabled' &&
     ( $global == n/a || $global == "$version" ) ]]
}

receipt() {
  emit "$1 $installed $packaged $package_skills $default_sync $single_server $drop_in $global"
}

stage_vps() (
  local release_dir=${package_dir%/package} want got
  rm -rf -- "$release_dir" && mkdir -p -- "$release_dir" && cd -- "$release_dir" || return 1
  npm pack -q "axstack@$version" || return $?
  want=$(npm view "axstack@$version" dist.integrity) || return $?
  got=$(openssl dgst -sha512 -binary "axstack-$version.tgz" | base64 -w0) || return $?
  [[ $want == "sha512-$got" ]] || return 1
  tar -xzf "axstack-$version.tgz" || return $?
  printf '#!/bin/sh\nexec "%s" "%s/bin/axstack.js" "$@"\n' "$global_bun" "$package_dir" > "$cli" &&
    chmod 755 "$cli"
)

install_release() {
  if [[ $host == axat-vps ]]; then
    stage_vps || return $?
    # The shadow Claude settings are symlinked on this host.
    env -u CLAUDE_CONFIG_DIR "$cli" install --preset mixed --harness claude --yes || return $?
    env -u CLAUDE_CONFIG_DIR "$cli" install --preset mixed --harness codex --yes || return $?
    env -u CLAUDE_CONFIG_DIR "$cli" install --preset mixed --harness opencode --no-claude-settings --yes || return $?
    "$global_bun" add -g "axstack@$version"
  else
    printf '%s\n' "$reinstall" | bash -s -- "$version" || return $?
    if [[ $host == io ]]; then
      bash -lc '~/.local/bin/axstack install --preset mixed --harness opencode --no-claude-settings --yes'
    fi
  fi
}

# Lock the existing state directory across the final read, the write and
# the receipt. A disconnected SSH client does not release this host lock
# while its remote installer is still running.
bun=$global_bun
if [[ $host != axat-vps ]]; then
  bun=/usr/bin/bun
  [[ -x $bun ]] || bun=$(command -v bun) || hold unknown
fi
[[ -x $bun ]] || hold unknown
[[ -d $data && ! -L $data && -d $HOME/.local/bin && -x $HOME/.local/bin ]] || hold unknown
exec 9<"$data" || hold unknown
flock -n -E 75 9
case $? in 0) ;; 75) hold busy ;; *) hold unknown ;; esac
observe || hold unknown
for existing in "$installed" "$global"; do
  if stable_version "$existing" && [[ $existing != "$version" &&
      $(printf '%s\n%s\n' "$version" "$existing" | sort -V | tail -n 1) == "$existing" ]]; then
    hold newer
  fi
done
if ready; then receipt done; exit 0; fi
[[ $default_sync == 'active enabled' && $single_server == 'active enabled' ]] || hold timer
if [[ $action == probe ]]; then emit pending; exit 0; fi
[[ $action == apply && -n ${reinstall:-} && -w $data && -w $HOME/.local/bin &&
   ! -L $cli && ! -L $data/releases && ! -L $data/releases/$version ]] || hold unknown
status=0
install_release >/dev/null 2>&1 || status=$?
observe || hold readback
if ((status != 0)); then emit "failure install $status"; exit 0; fi
if ready; then receipt done; else receipt mismatch; fi
