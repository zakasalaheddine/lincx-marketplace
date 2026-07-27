#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== lint (check-plugin.mjs) ==="
node scripts/check-plugin.mjs

echo "=== unit (node --test tests/*.test.mjs) ==="
node --test tests/*.test.mjs

echo "✔ all green"
