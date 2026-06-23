#!/usr/bin/env bash
# wiki/wiki-graph.sh — graphify orchestration for the wiki knowledge graph.
#
# Bridges the wiki hash check (wiki-hash.sh) and graphify. The wiki hash diff is the
# single source of truth for "what changed"; this script uses it to gate and scope the
# incremental graph rebuild, then publishes graphify's output into wiki/graph/ so Obsidian
# (and the Command Centre plugin) can read it.
#
# Usage:
#   ./wiki/wiki-graph.sh build           — full first-time build (delegates LLM pass to /graphify)
#   ./wiki/wiki-graph.sh export          — re-publish exports from an existing graph.json
#   ./wiki/wiki-graph.sh update          — incremental rebuild, gated by the wiki hash diff
#   ./wiki/wiki-graph.sh status [--json] — graph + wiki freshness (human or machine readable)
#   ./wiki/wiki-graph.sh refresh         — snapshot the wiki hash baseline after an update
#   ./wiki/wiki-graph.sh install-plugin  — build + install the Obsidian Command Centre plugin
#
# Compatible with macOS bash 3.x (no associative arrays).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ============================================
# CONFIG — edit at setup to match your project
# ============================================
# Source roots to graph (same intent as wiki-hash.sh TRACK_PATTERNS). Space-separated,
# relative to the repo root. graphify reads these as the code side of the corpus.
GRAPH_SOURCES="{{SOURCE_PATTERNS_ROOT}}"          # e.g. "src" or "lib src"
# Curated wiki pages/dirs to graph (relative to the wiki dir). NEVER include graph/.
CURATED_WIKI="overview.md architecture.md configuration.md api-reference.md services types flows api security concepts finance clients projects knowledge"
# Published graph location Obsidian reads (inside the vault).
GRAPH_OUT="$SCRIPT_DIR/graph"
# graphify's working dir (created at the repo root by the /graphify skill / CLI).
GRAPHIFY_OUT="$REPO_ROOT/graphify-out"
PLUGIN_ID="wiki-command-centre"
PLUGIN_SRC="$SCRIPT_DIR/obsidian-plugin"

# Code file extensions (mirrors graphify/references/update.md) — used to decide whether a
# changed set is code-only (scriptable, no LLM) or includes docs (needs /graphify --update).
CODE_EXTS=" py ts js tsx jsx go rs java cpp c cc cxx hpp h rb swift kt kts cs scala php lua m mm "

# ---- graphify interpreter resolution (subset of graphify SKILL Step 1) ----------------
resolve_graphify() {
  if [ -f "$GRAPHIFY_OUT/.graphify_python" ]; then
    GPY="$(cat "$GRAPHIFY_OUT/.graphify_python")"
    [ -x "$GPY" ] && return 0
  fi
  local bin shebang
  GPY=""
  bin="$(command -v graphify 2>/dev/null || true)"
  if [ -n "$bin" ]; then
    shebang="$(head -1 "$bin" | tr -d '#!' )"
    case "$shebang" in
      *[!a-zA-Z0-9/_.-]*) ;;
      *) "$shebang" -c "import graphify" 2>/dev/null && GPY="$shebang" ;;
    esac
  fi
  [ -z "$GPY" ] && GPY="python3"
  return 0
}

ensure_graphify() {
  resolve_graphify
  if ! "$GPY" -c "import graphify" 2>/dev/null; then
    echo "graphify not found. Installing..." >&2
    if command -v uv >/dev/null 2>&1; then
      uv tool install --upgrade graphifyy -q 2>&1 | tail -2 >&2
      local uvpy
      uvpy="$(uv tool run graphifyy python -c 'import sys; print(sys.executable)' 2>/dev/null || true)"
      [ -n "$uvpy" ] && GPY="$uvpy"
    else
      "$GPY" -m pip install graphifyy -q 2>/dev/null \
        || "$GPY" -m pip install graphifyy -q --break-system-packages 2>&1 | tail -2 >&2
    fi
  fi
  if ! "$GPY" -c "import graphify" 2>/dev/null; then
    echo "ERROR: graphify could not be installed. Install it manually: pip install graphifyy" >&2
    return 1
  fi
  mkdir -p "$GRAPHIFY_OUT"
  # Write the interpreter path from bash (not embedded in a Python -c string) so a repo path
  # containing a single quote can't break out of the Python literal.
  local gpy_exe
  gpy_exe="$("$GPY" -c 'import sys; print(sys.executable)')"
  printf '%s' "$gpy_exe" > "$GRAPHIFY_OUT/.graphify_python"
  return 0
}

# Build the explicit corpus path list (source roots + curated wiki pages, never graph/).
corpus_paths() {
  local p
  for p in $GRAPH_SOURCES; do
    [ -e "$REPO_ROOT/$p" ] && echo "$REPO_ROOT/$p"
  done
  for p in $CURATED_WIKI; do
    [ -e "$SCRIPT_DIR/$p" ] && echo "$SCRIPT_DIR/$p"
  done
}

# ---- exports: publish graphify-out/graph.json into the vault -----------------------------
do_export() {
  if [ ! -f "$GRAPHIFY_OUT/graph.json" ]; then
    echo "No graph.json at $GRAPHIFY_OUT. Run 'wiki-graph.sh build' first." >&2
    return 1
  fi
  ensure_graphify || return 1
  mkdir -p "$GRAPH_OUT"
  echo "Publishing graph into $GRAPH_OUT ..."
  ( cd "$REPO_ROOT" && graphify export obsidian --dir "$GRAPH_OUT/nodes" 2>&1 | tail -3 ) || \
    echo "  (obsidian export skipped — 'graphify export obsidian' unavailable)" >&2
  ( cd "$REPO_ROOT" && graphify export html 2>&1 | tail -2 ) || \
    echo "  (html export skipped)" >&2
  [ -f "$GRAPHIFY_OUT/graph.html" ]       && cp "$GRAPHIFY_OUT/graph.html" "$GRAPH_OUT/graph.html"
  [ -f "$GRAPHIFY_OUT/GRAPH_REPORT.md" ]  && cp "$GRAPHIFY_OUT/GRAPH_REPORT.md" "$GRAPH_OUT/GRAPH_REPORT.md"
  [ -f "$GRAPHIFY_OUT/graph.json" ]       && cp "$GRAPHIFY_OUT/graph.json" "$GRAPH_OUT/graph.json"
  echo "Published: $GRAPH_OUT/{graph.html,GRAPH_REPORT.md,graph.json,nodes/}"
}

# ---- build: full first-time graph -------------------------------------------------------
do_build() {
  ensure_graphify || return 1
  if [ -f "$GRAPHIFY_OUT/graph.json" ]; then
    echo "Existing graph found — re-publishing exports. For a fresh full rebuild, delete $GRAPHIFY_OUT first."
    do_export
    return $?
  fi
  cat <<EOF
No knowledge graph yet. The full build runs semantic extraction over your docs/wiki, which
needs the LLM — run it through the /graphify skill (it dispatches extraction subagents):

    /graphify $(corpus_paths | tr '\n' ' ') --obsidian --obsidian-dir $GRAPH_OUT/nodes

When it finishes (graphify-out/graph.json exists), publish into the vault with:

    bash wiki/wiki-graph.sh export
    bash wiki/wiki-graph.sh refresh
EOF
}

# ---- changed-file partition from the wiki hash diff ------------------------------------
# Echoes two lines: "CODE <n>" and "DOC <n>" plus the changed file list on stderr-free path.
changed_files() {
  # Array elements in wiki-hash.sh's JSON are 4-space-indented quoted lines; the key lines
  # ("changed":, "added":) use 2 spaces. Selecting '^    "' yields only file paths — robust
  # to filenames that contain words like "changed" or that have no '/' (root-level files).
  bash "$SCRIPT_DIR/wiki-hash.sh" diff 2>/dev/null \
    | grep -E '^    "' \
    | sed -E 's/^    "//; s/",?$//' \
    | sort -u
}

classify_changes() {
  local f ext code=0 doc=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    ext="${f##*.}"
    case "$CODE_EXTS" in
      *" $ext "*) code=$((code+1)) ;;
      *)          doc=$((doc+1)) ;;
    esac
  done < <(changed_files)
  echo "$code $doc"
}

# ---- update: incremental, gated by the wiki hash ----------------------------------------
do_update() {
  local diff_json has_changes
  diff_json=$(bash "$SCRIPT_DIR/wiki-hash.sh" diff 2>/dev/null)
  has_changes=$(echo "$diff_json" | grep '"has_changes"' | grep -o 'true' || echo false)
  if [ "$has_changes" != "true" ]; then
    echo "Graph current — no tracked files changed since the last snapshot."
    return 0
  fi

  local counts code doc
  counts=$(classify_changes)
  code=$(echo "$counts" | awk '{print $1}')
  doc=$(echo "$counts" | awk '{print $2}')
  echo "Changed since snapshot: $code code file(s), $doc doc/wiki file(s)."

  if [ "$doc" -gt 0 ]; then
    cat <<EOF

ACTION_REQUIRED: doc/wiki changes need semantic (LLM) re-extraction. Run:

    /graphify $(corpus_paths | tr '\n' ' ') --update

then publish + snapshot:

    bash wiki/wiki-graph.sh export
    bash wiki/wiki-graph.sh refresh
EOF
    return 0
  fi

  # Code-only: deterministic incremental AST rebuild via graphify's own update machinery.
  ensure_graphify || return 1
  echo "Code-only changes — running deterministic incremental update (no LLM)..."
  if ( cd "$REPO_ROOT" && graphify update 2>&1 | tail -5 ); then
    do_export && do_refresh
    echo "Graph updated and baseline refreshed."
  else
    cat <<EOF
'graphify update' was unavailable or failed. Fall back to the skill flow:

    /graphify $(corpus_paths | tr '\n' ' ') --update
    bash wiki/wiki-graph.sh export && bash wiki/wiki-graph.sh refresh
EOF
    return 1
  fi
}

# ---- status -----------------------------------------------------------------------------
do_status() {
  local json="${1:-}"
  local diff_json has_changes n_changed counts code doc graph_exists
  diff_json=$(bash "$SCRIPT_DIR/wiki-hash.sh" diff 2>/dev/null || echo '{}')
  has_changes=$(echo "$diff_json" | grep '"has_changes"' | grep -o 'true\|false' | head -1)
  [ -z "$has_changes" ] && has_changes=false
  n_changed=$(echo "$diff_json" | grep '"changed_count"' | grep -o '[0-9]*' | head -1)
  [ -z "$n_changed" ] && n_changed=0
  counts=$(classify_changes)
  code=$(echo "$counts" | awk '{print $1}')
  doc=$(echo "$counts" | awk '{print $2}')
  graph_exists=false
  [ -f "$GRAPH_OUT/graph.json" ] && graph_exists=true

  if [ "$json" = "--json" ]; then
    printf '{"graph_exists":%s,"stale":%s,"changed":%s,"code_changed":%s,"doc_changed":%s,"report":"graph/GRAPH_REPORT.md","html":"graph/graph.html"}\n' \
      "$graph_exists" "$has_changes" "$n_changed" "$code" "$doc"
    return 0
  fi

  echo "=== Wiki Knowledge Graph Status ==="
  echo "Graph published: $graph_exists ($GRAPH_OUT/graph.json)"
  echo "Stale:           $has_changes ($n_changed tracked files changed: $code code, $doc doc/wiki)"
  if [ "$has_changes" = "true" ]; then
    if [ "$doc" -gt 0 ]; then
      echo "Next: /graphify ... --update  (doc changes need the LLM), then 'wiki-graph.sh export refresh'"
    else
      echo "Next: bash wiki/wiki-graph.sh update  (code-only, scripted)"
    fi
  else
    echo "Graph is in sync with the codebase + curated wiki."
  fi
}

do_refresh() { bash "$SCRIPT_DIR/wiki-hash.sh" snapshot; }

# ---- query: natural-language query against the built graph -------------------------------
# graphify's fast path reads graphify-out/graph.json relative to cwd, so run from REPO_ROOT
# (where the /graphify skill / CLI writes graphify-out/). Centralized here so the plugin
# doesn't need to know where the graph lives.
do_query() {
  local q="${1:-}"
  if [ -z "$q" ]; then echo "Usage: $0 query \"<question>\"" >&2; return 1; fi
  if [ ! -f "$GRAPHIFY_OUT/graph.json" ]; then
    echo "No graph yet. Run 'wiki-graph.sh build' first." >&2
    return 1
  fi
  if ! command -v graphify >/dev/null 2>&1; then
    echo "ERROR: graphify not found on PATH." >&2
    return 1
  fi
  ( cd "$REPO_ROOT" && graphify query "$q" )
}

# ---- install-plugin ---------------------------------------------------------------------
do_install_plugin() {
  local dest="$SCRIPT_DIR/.obsidian/plugins/$PLUGIN_ID"
  if [ ! -f "$PLUGIN_SRC/main.js" ]; then
    if [ -f "$PLUGIN_SRC/package.json" ]; then
      echo "Building plugin in $PLUGIN_SRC ..."
      ( cd "$PLUGIN_SRC" && npm install --silent && npm run build ) \
        || { echo "ERROR: plugin build failed. Run 'npm install && npm run build' in $PLUGIN_SRC." >&2; return 1; }
    else
      echo "ERROR: plugin source not found at $PLUGIN_SRC." >&2
      return 1
    fi
  fi
  mkdir -p "$dest"
  cp "$PLUGIN_SRC/manifest.json" "$dest/manifest.json"
  cp "$PLUGIN_SRC/main.js"       "$dest/main.js"
  [ -f "$PLUGIN_SRC/styles.css" ] && cp "$PLUGIN_SRC/styles.css" "$dest/styles.css"
  echo "Installed '$PLUGIN_ID' into $dest"
  echo "Open this folder as an Obsidian vault, then enable the plugin under Community plugins."
}

case "${1:-help}" in
  build)          do_build ;;
  export)         do_export ;;
  update)         do_update ;;
  status)         do_status "${2:-}" ;;
  refresh)        do_refresh ;;
  query)          do_query "${2:-}" ;;
  install-plugin) do_install_plugin ;;
  *)
    echo "Usage: $0 {build|export|update|status [--json]|refresh|query \"<q>\"|install-plugin}"
    ;;
esac
