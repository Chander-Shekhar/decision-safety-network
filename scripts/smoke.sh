#!/usr/bin/env bash
# Deployed smoke for the Decision Safety Network API. Not run in this pass.
# Usage: BASE_URL=https://<service-host> ID_TOKEN=<synthetic-user-id-token> scripts/smoke.sh
set -euo pipefail
: "${BASE_URL:?BASE_URL is required}"
: "${ID_TOKEN:?ID_TOKEN (synthetic test account) is required}"

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
expect() { [ "$1" = "$2" ] || { echo "FAIL: $3 (got $1, want $2)"; exit 1; }; echo "ok: $3"; }

expect "$(code "$BASE_URL/healthz")" 200 "health check"
expect "$(code "$BASE_URL/api/v1/cases/x")" 401 "unauthenticated case read denied"
expect "$(code -X POST "$BASE_URL/internal/retention/sweep" -H "Authorization: Bearer $ID_TOKEN")" 401 "user token denied on internal sweep"
expect "$(code "$BASE_URL/api/v1/registry/demo-bank" -H "Authorization: Bearer $ID_TOKEN")" 200 "Demo Bank registry (simulated)"
expect "$(code -X PUT "$BASE_URL/api/v1/plan" -H "Authorization: Bearer $ID_TOKEN" -H 'Content-Type: application/json' \
  -d '{"thresholdMinor":1000000,"bankId":"demo-bank","processingConsent":true,"retentionMode":"facts-24h","allySharingConsent":true,"exportConsent":true}')" 200 "save plan"
CASE_ID=$(curl -s -X POST "$BASE_URL/api/v1/cases" -H "Authorization: Bearer $ID_TOKEN" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$CASE_ID" ] || { echo "FAIL: case not created"; exit 1; }
echo "ok: case created"
# Live-Gemini gate: the full journey (segments -> facts/extract) must be run against the deployed URL
# and the recorded model ID checked by hand; this script never uses a canned response or test double.
echo "smoke basics passed; run the documented journey for the live-Gemini gate"
