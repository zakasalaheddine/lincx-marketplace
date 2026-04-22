#!/usr/bin/env bash
set -u
FAIL=0
fail() { echo "✖ $*"; FAIL=1; }
pass() { echo "✔ $*"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK="$PLUGIN_ROOT/hooks/post-edit-preview.sh"

mktemp_dir() { mktemp -d "${TMPDIR:-/tmp}/lincx-hook-XXXXXX"; }

# --- Case 1: no session state → exit 0, nothing created ---
DIR=$(mktemp_dir)
OUT=$(CLAUDE_PROJECT_DIR="$DIR" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" <<<'{"tool_input":{"file_path":"'"$DIR"'/ad.html"}}' 2>&1)
CODE=$?
if [ $CODE -eq 0 ] && [ ! -f "$DIR/.lincx-session.preview.pending" ]; then
  pass "case 1: no session state → no-op"
else
  fail "case 1: unexpected exit=$CODE marker=$([ -f "$DIR/.lincx-session.preview.pending" ] && echo yes || echo no) out=$OUT"
fi
rm -rf "$DIR"

# --- Case 2: session exists, untouched path → no marker ---
DIR=$(mktemp_dir)
cat > "$DIR/.lincx-session.json" <<'EOF'
{ "previewDisabled": false, "activeTemplates": [ { "id":"e1", "htmlPath":"ads/a.html", "cssPath":"ads/a.css", "previewPath":"ads/preview.html", "cagSchema":{"fields":[{"name":"headline","type":"string"}]} } ] }
EOF
CLAUDE_PROJECT_DIR="$DIR" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" <<<'{"tool_input":{"file_path":"'"$DIR"'/unrelated.txt"}}' >/dev/null 2>&1
if [ ! -f "$DIR/.lincx-session.preview.pending" ]; then
  pass "case 2: untouched path → no dispatch"
else
  fail "case 2: marker appeared unexpectedly"
fi
rm -rf "$DIR"

# --- Case 3: matching path → marker appears and preview.html is produced ---
DIR=$(mktemp_dir)
mkdir -p "$DIR/ads"
cp "$PLUGIN_ROOT/tests/fixtures/simple-template/template.html" "$DIR/ads/a.html"
cp "$PLUGIN_ROOT/tests/fixtures/simple-template/template.css" "$DIR/ads/a.css"
SCHEMA=$(cat "$PLUGIN_ROOT/tests/fixtures/simple-template/cag-schema.json")
cat > "$DIR/.lincx-session.json" <<EOF
{ "previewDisabled": false, "previewOpened": true, "activeTemplates": [
  { "id":"e1", "htmlPath":"$DIR/ads/a.html", "cssPath":"$DIR/ads/a.css", "previewPath":"$DIR/ads/preview.html", "previewOpened": true, "cagSchema": $SCHEMA }
] }
EOF
CLAUDE_PROJECT_DIR="$DIR" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" <<<'{"tool_input":{"file_path":"'"$DIR"'/ads/a.html"}}' >/dev/null 2>&1
for i in 1 2 3 4 5 6; do [ -f "$DIR/ads/preview.html" ] && break; sleep 0.5; done
if [ -f "$DIR/ads/preview.html" ]; then
  pass "case 3: matching path → preview.html produced"
else
  fail "case 3: preview.html not produced (log: $(cat "$DIR/.lincx-session.log" 2>/dev/null))"
fi
rm -rf "$DIR"

# --- Case 4: two rapid fires → marker mtime stays pinned to first ---
DIR=$(mktemp_dir)
mkdir -p "$DIR/ads"
cp "$PLUGIN_ROOT/tests/fixtures/simple-template/template.html" "$DIR/ads/a.html"
cp "$PLUGIN_ROOT/tests/fixtures/simple-template/template.css" "$DIR/ads/a.css"
cat > "$DIR/.lincx-session.json" <<EOF
{ "previewDisabled": false, "activeTemplates": [
  { "id":"e1", "htmlPath":"$DIR/ads/a.html", "cssPath":"$DIR/ads/a.css", "previewPath":"$DIR/ads/preview.html", "previewOpened": true, "cagSchema": $SCHEMA }
] }
EOF
CLAUDE_PROJECT_DIR="$DIR" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" <<<'{"tool_input":{"file_path":"'"$DIR"'/ads/a.html"}}' >/dev/null 2>&1
FIRST_MARK=$(stat -f %m "$DIR/.lincx-session.preview.pending" 2>/dev/null || stat -c %Y "$DIR/.lincx-session.preview.pending" 2>/dev/null)
CLAUDE_PROJECT_DIR="$DIR" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" <<<'{"tool_input":{"file_path":"'"$DIR"'/ads/a.html"}}' >/dev/null 2>&1
SECOND_MARK=$(stat -f %m "$DIR/.lincx-session.preview.pending" 2>/dev/null || stat -c %Y "$DIR/.lincx-session.preview.pending" 2>/dev/null)
if [ "$FIRST_MARK" = "$SECOND_MARK" ]; then
  pass "case 4: rapid second fire debounced"
else
  fail "case 4: marker mtime changed (first=$FIRST_MARK second=$SECOND_MARK)"
fi
rm -rf "$DIR"

if [ $FAIL -ne 0 ]; then echo "hook tests failed"; exit 1; fi
echo "hook tests passed"
