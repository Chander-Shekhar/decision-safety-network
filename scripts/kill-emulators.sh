#!/usr/bin/env bash
# Find and kill stray Firebase emulator / dev-server processes that squat on the
# local dev ports after `npm run dev:api` exits uncleanly. Safe to run anytime.
# Usage: scripts/kill-emulators.sh [--dry-run]
set -euo pipefail

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

# Ports: 9099 auth, 8080 firestore, 9150 firestore gRPC, 4400 hub, 4500 logging,
# 8787 api dev-server.
PORTS=(9099 8080 9150 4400 4500 8787)

found=false
for p in "${PORTS[@]}"; do
  # All PIDs listening on the port (there can be more than one).
  for pid in $(lsof -nP -iTCP:"$p" -sTCP:LISTEN -t 2>/dev/null | sort -u); do
    found=true
    cmd=$(ps -o command= -p "$pid" 2>/dev/null | cut -c1-80)
    if $DRY_RUN; then
      echo "would kill port $p -> PID $pid: $cmd"
      continue
    fi
    echo "killing port $p -> PID $pid: $cmd"
    kill "$pid" 2>/dev/null || true
    # Give it a moment, then force if still alive.
    for _ in 1 2 3; do
      ps -p "$pid" >/dev/null 2>&1 || break
      sleep 1
    done
    if ps -p "$pid" >/dev/null 2>&1; then
      echo "  still alive, SIGKILL $pid"
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
done

$found || echo "no emulator/dev-server processes found on dev ports"

if ! $DRY_RUN; then
  echo "--- remaining listeners ---"
  for p in "${PORTS[@]}"; do
    lsof -nP -iTCP:"$p" -sTCP:LISTEN -t >/dev/null 2>&1 && echo "port $p STILL IN USE" || true
  done
  echo "done"
fi
