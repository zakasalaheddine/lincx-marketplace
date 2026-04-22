#!/usr/bin/env bash
# PostToolUse hook — dispatch the preview renderer if the edited path matches
# a tracked template in .lincx-session.json.
#
# Reads hook JSON payload on stdin. Does nothing unless a session exists and
# the edited path matches. Debounces with a marker file. Never fails loudly.
set -u

trap 'exit 0' ERR

CWD="${CLAUDE_PROJECT_DIR:-$PWD}"
STATE="$CWD/.lincx-session.json"
LOG="$CWD/.lincx-session.log"
MARKER="$CWD/.lincx-session.preview.pending"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"

log() { printf '[%s] hook: %s\n' "$(date -u +%FT%TZ)" "$*" >> "$LOG" 2>/dev/null || true; }

# 1. No session state → silent no-op.
[ -f "$STATE" ] || exit 0
# 2. Node missing → silent no-op; log once.
command -v node >/dev/null 2>&1 || { log "node not found; skipping"; exit 0; }

# 3. Preview disabled → exit.
DISABLED=$(node --input-type=module -e "
  import fs from 'node:fs';
  try { const s = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(s.previewDisabled ? '1' : '0'); }
  catch { process.stdout.write('0'); }
" "$STATE" 2>/dev/null || echo 0)
[ "$DISABLED" = "1" ] && exit 0

# 4. Read hook payload from stdin; extract file_path.
PAYLOAD="$(cat || true)"
[ -z "$PAYLOAD" ] && exit 0

EDITED_PATH=$(printf '%s' "$PAYLOAD" | node --input-type=module -e "
  let d = '';
  process.stdin.on('data', c => d += c).on('end', () => {
    try {
      const j = JSON.parse(d);
      const p = j.tool_input && (j.tool_input.file_path || j.tool_input.filePath);
      if (p) process.stdout.write(p);
    } catch {}
  });
" 2>/dev/null || true)
[ -z "$EDITED_PATH" ] && exit 0

# 5. Resolve entry id via session-state.mjs.
ENTRY_ID=$(node --input-type=module -e "
  import { readSessionState, findEntryByPath } from '${PLUGIN_ROOT}/scripts/session-state.mjs';
  const s = readSessionState(process.argv[1]);
  if (!s) process.exit(0);
  const e = findEntryByPath(s, process.argv[2]);
  if (e) process.stdout.write(e.id);
" "$STATE" "$EDITED_PATH" 2>/dev/null || true)
[ -z "$ENTRY_ID" ] && exit 0

# 6. Debounce: marker < 2 s old → skip.
if [ -f "$MARKER" ]; then
  NOW=$(date +%s)
  MARK_AT=$(stat -f %m "$MARKER" 2>/dev/null || stat -c %Y "$MARKER" 2>/dev/null || echo 0)
  AGE=$(( NOW - MARK_AT ))
  if [ "$AGE" -lt 2 ]; then
    log "debounced entry=$ENTRY_ID (age=${AGE}s)"
    exit 0
  fi
fi

# 7. Write marker; dispatch renderer.
echo "$ENTRY_ID" > "$MARKER"
log "dispatch entry=$ENTRY_ID path=$EDITED_PATH"
(cd "$CWD" && node "${PLUGIN_ROOT}/scripts/preview-render.mjs" "$ENTRY_ID") >> "$LOG" 2>&1 &
disown 2>/dev/null || true

exit 0
