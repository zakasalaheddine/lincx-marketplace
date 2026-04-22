#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== unit tests =="
node --test tests/*.test.mjs

echo "== hook fixture =="
bash tests/hook.test.sh

echo "== structural lint =="
node scripts/check-plugin.mjs

echo "all tests passed"
