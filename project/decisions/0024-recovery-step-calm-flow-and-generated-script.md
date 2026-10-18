# 0024: Recovery step reduced to a calm ordered flow; call script is model-written

- **Status:** Accepted
- **Date:** 2026-10-18
- **Owners:** Orchestrator / DSN-038
- **Related task:** DSN-038
- **PRD references:** Core MVP recovery (frame 06), DSN-027 guided account protection
- **Supersedes:** The hardcoded template script and fixed fictional helpline as the only source
- **Superseded by:** None

## Context

The Recovery page was long and demo-worded: duplicate "First-hour options" cards showing raw status, a fixed fictional helpline number, a template "What to say" script, call extracts shown under "Your details" with internal field names, and local "Notes" buttons.

## Decision

- Page order: calm opener, call the bank (Decide-step `officialContact` as a `tel:` link; no number invented when none was found), model-written copyable script, report to 1930, what the caller said (plain labels), what you paid (prefill match/edit/form), a short recovery-scam warning.
- Removed: First-hour cards, "Still needed", local-acknowledgement Notes UI (API route kept), "(simulated)" tag.
- Script: `RecoveryScriptWriter` (Gemini, `recovery-script-v1`) is given only owner-confirmed facts and owner-typed paid details, sanitised; output is plain text. Any failure, or the test-double Gemini, keeps the deterministic template. Mounted on the recovery routes, never blocks entering recovery beyond one model call.

## Consequences

- One extra model call per recovery state read/command when live.
- The fixed `1800 000 0000` helpline is no longer shown; the contract field remains.
