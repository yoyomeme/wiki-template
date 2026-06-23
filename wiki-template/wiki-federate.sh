#!/usr/bin/env bash
# wiki/wiki-federate.sh — desktop-hub federation across many wikis.
#
# The hub is itself a wiki (run from its wiki dir = the Obsidian vault). It registers other
# wikis, symlinks them into repos/ so one vault spans everything, and merges every child
# graph.json into one master graph (graphify merge-graphs — deterministic, no LLM).
#
# Layout (all inside the hub's wiki dir, which is the vault):
#   ./.wiki-roots.tsv      registry: name <TAB> wiki-path <TAB> graph.json <TAB> flags
#   ./repos/<name>         symlink → each registered external wiki dir
#   ./master-graph/        merged master graph (graph.json, graph.html, nodes/)
#   ./.federation-hashes.json   meta-hash baseline of each child graph.json
#
# Usage:
#   ./wiki/wiki-federate.sh register <name> <path-to-wiki> [--private]
#   ./wiki/wiki-federate.sh status [--json]
#   ./wiki/wiki-federate.sh build
#   ./wiki/wiki-federate.sh update
#   ./wiki/wiki-federate.sh refresh
#
# Compatible with macOS bash 3.x.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGISTRY="$SCRIPT_DIR/.wiki-roots.tsv"
REPOS_DIR="$SCRIPT_DIR/repos"
MASTER="$SCRIPT_DIR/master-graph"
FED_HASHES="$SCRIPT_DIR/.federation-hashes.json"

hash_file() { shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'; }

ensure_registry() {
  if [ ! -f "$REGISTRY" ]; then
    printf '# name\twiki-path\tgraph.json\tflags\n' > "$REGISTRY"
  fi
}

# Emit non-comment registry rows.
registry_rows() {
  [ -f "$REGISTRY" ] || return 0
  grep -v '^[[:space:]]*#' "$REGISTRY" | grep -v '^[[:space:]]*$'
}

# ---- register ---------------------------------------------------------------------------
do_register() {
  local name="${1:-}" path="${2:-}" flag="${3:-}"
  if [ -z "$name" ] || [ -z "$path" ]; then
    echo "Usage: $0 register <name> <path-to-wiki> [--private]" >&2
    return 1
  fi
  if [ ! -d "$path" ]; then
    echo "ERROR: '$path' is not a directory." >&2
    return 1
  fi
  local abspath flags="" gjson
  abspath="$(cd "$path" && pwd)"
  gjson="$abspath/graph/graph.json"
  [ "$flag" = "--private" ] && flags="private"

  ensure_registry
  if registry_rows | awk -F'\t' '{print $1}' | grep -qx "$name"; then
    echo "ERROR: '$name' is already registered. Remove its line from $REGISTRY first." >&2
    return 1
  fi
  printf '%s\t%s\t%s\t%s\n' "$name" "$abspath" "$gjson" "$flags" >> "$REGISTRY"

  mkdir -p "$REPOS_DIR"
  if [ ! -e "$REPOS_DIR/$name" ]; then
    ln -s "$abspath" "$REPOS_DIR/$name"
    echo "Symlinked repos/$name → $abspath"
  fi
  echo "Registered '$name'${flags:+ ($flags)}."
}

# ---- collect child graphs (respecting --private) ----------------------------------------
# Echoes graph.json paths for non-private children that exist.
mergeable_graphs() {
  registry_rows | while IFS=$'\t' read -r name path gjson flags; do
    [ -z "$gjson" ] && continue
    case "$flags" in *private*) continue ;; esac
    [ -f "$gjson" ] && echo "$gjson"
  done
}

# ---- meta-hash baseline -----------------------------------------------------------------
write_fed_hashes() {
  local tmp first=true
  tmp="$(mktemp)"
  echo "{" > "$tmp"
  registry_rows | while IFS=$'\t' read -r name path gjson flags; do
    [ -f "$gjson" ] || continue
    local h
    h="$(hash_file "$gjson")"
    if [ "$first" = true ]; then first=false; else echo "," >> "$tmp"; fi
    printf '  "%s": "%s"' "$name" "$h" >> "$tmp"
  done
  # `first` is lost to the subshell; just always close cleanly (trailing entries handled by commas above).
  echo "" >> "$tmp"
  echo "}" >> "$tmp"
  mv "$tmp" "$FED_HASHES"
}

# Returns 0 (drift) if any child graph hash differs from the baseline or is new.
has_drift() {
  [ -f "$FED_HASHES" ] || return 0
  local drift=1
  while IFS=$'\t' read -r name path gjson flags; do
    [ -f "$gjson" ] || continue
    local cur stored
    cur="$(hash_file "$gjson")"
    stored="$(grep -E "\"$name\"[[:space:]]*:" "$FED_HASHES" | sed -E 's/.*: *"([0-9a-f]*)".*/\1/' | head -1)"
    if [ "$cur" != "$stored" ]; then drift=0; fi
  done < <(registry_rows)
  return $drift
}

# ---- merge + export ---------------------------------------------------------------------
do_merge_export() {
  if ! command -v graphify >/dev/null 2>&1; then
    echo "ERROR: graphify not found on PATH. Install it: pip install graphifyy" >&2
    return 1
  fi
  local graphs
  graphs="$(mergeable_graphs)"
  if [ -z "$graphs" ]; then
    echo "No child graphs to merge. Build each child's graph first (wiki-graph.sh build)." >&2
    return 1
  fi
  local n
  n="$(echo "$graphs" | grep -c .)"
  echo "Merging $n child graph(s) into the master graph..."
  mkdir -p "$MASTER/graphify-out"
  # shellcheck disable=SC2046
  if ! ( cd "$MASTER" && graphify merge-graphs $(echo "$graphs" | tr '\n' ' ') --out graphify-out/graph.json 2>&1 | tail -4 ); then
    echo "ERROR: merge-graphs failed." >&2
    return 1
  fi
  ( cd "$MASTER" && graphify export html 2>&1 | tail -2 ) || echo "  (html export skipped)" >&2
  ( cd "$MASTER" && graphify export obsidian --dir nodes 2>&1 | tail -2 ) || echo "  (obsidian export skipped)" >&2
  [ -f "$MASTER/graphify-out/graph.html" ] && cp "$MASTER/graphify-out/graph.html" "$MASTER/graph.html"
  [ -f "$MASTER/graphify-out/graph.json" ] && cp "$MASTER/graphify-out/graph.json" "$MASTER/graph.json"
  [ -f "$MASTER/graphify-out/GRAPH_REPORT.md" ] && cp "$MASTER/graphify-out/GRAPH_REPORT.md" "$MASTER/GRAPH_REPORT.md"
  write_fed_hashes
  echo "Master graph published to $MASTER/"
}

do_build() {
  # Warn about children missing a graph (each child must build its own first).
  registry_rows | while IFS=$'\t' read -r name path gjson flags; do
    if [ ! -f "$gjson" ]; then
      echo "NOTE: '$name' has no graph yet — run: (cd \"$path\" && bash wiki-graph.sh build)"
    fi
  done
  do_merge_export
}

do_update() {
  if has_drift; then
    echo "Child graph drift detected — re-merging master graph."
    do_merge_export
  else
    echo "Master graph current — no child graph changed since last federation."
  fi
}

do_refresh() { write_fed_hashes; echo "Federation baseline refreshed."; }

do_status() {
  local json="${1:-}"
  local total drifted=0 missing=0
  total="$(registry_rows | grep -c . )"
  while IFS=$'\t' read -r name path gjson flags; do
    [ -z "$name" ] && continue
    if [ ! -f "$gjson" ]; then missing=$((missing+1)); continue; fi
    local cur stored
    cur="$(hash_file "$gjson")"
    stored="$(grep -E "\"$name\"[[:space:]]*:" "$FED_HASHES" 2>/dev/null | sed -E 's/.*: *"([0-9a-f]*)".*/\1/' | head -1)"
    [ "$cur" != "$stored" ] && drifted=$((drifted+1))
  done < <(registry_rows)

  if [ "$json" = "--json" ]; then
    local master_exists=false
    [ -f "$MASTER/graph.json" ] && master_exists=true
    printf '{"registered":%s,"drifted":%s,"missing_graph":%s,"master_exists":%s}\n' \
      "$total" "$drifted" "$missing" "$master_exists"
    return 0
  fi
  echo "=== Federation Status ==="
  echo "Registered wikis: $total"
  echo "Drifted (graph changed since last merge): $drifted"
  echo "Missing child graph: $missing"
  [ "$drifted" -gt 0 ] && echo "Run: bash wiki/wiki-federate.sh update"
}

case "${1:-help}" in
  register) shift; do_register "$@" ;;
  status)   do_status "${2:-}" ;;
  build)    do_build ;;
  update)   do_update ;;
  refresh)  do_refresh ;;
  *)
    echo "Usage: $0 {register <name> <path> [--private]|status [--json]|build|update|refresh}"
    ;;
esac
