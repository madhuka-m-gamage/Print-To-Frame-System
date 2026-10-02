#!/usr/bin/env bash
# Usage: link-deps.sh <main-checkout-path>   (run from the worktree root)
set -euo pipefail
main="${1:?main checkout path required}"
if [ -e node_modules ]; then
  echo "node_modules already present"; exit 0
fi
if [ -d "$main/node_modules" ] && cmp -s package-lock.json "$main/package-lock.json"; then
  ln -s "$main/node_modules" node_modules
  echo "linked node_modules from $main"
else
  npm ci --silent
  echo "installed node_modules (lockfile differs from $main)"
fi
