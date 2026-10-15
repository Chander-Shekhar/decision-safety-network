# DSN-038: UI polish (ongoing)

- **Scope:** enhancement — ongoing UX/clarity polish of the owner flow
- **Priority:** P2
- **Owner:** Orchestrator (solo owner — claim + implement + integrate per WORKFLOW "Solo owner")
- **Status:** in-progress (kept open; successive polish changes land under this one task per founder request — do not spin up a new task per tweak)
- **Branch/worktree:** committed directly to `main` in small, test-backed, `DSN-038:`-prefixed commits (lightweight iteration; founder reviews live)
- **Owned paths (this task):** `apps/web/src/App.tsx`, `apps/web/src/SessionScreen.tsx`, `apps/web/src/DecisionMap.tsx`, and their tests; this record. (Declare more as batches touch them.)
- **Dependencies:** DSN-034 (shell/nav), DSN-037 (breadcrumbs).
- **PRD references:** Core MVP owner journey (Session, Decision).
- **Started:** 2026-10-15
- **Last updated:** 2026-10-15

## Intent

Make the 7-step owner journey read as a clean, one-thing-at-a-time flow instead of showing every option at once. Back/forward is handled by the StepRail + breadcrumbs (DSN-037); this task declutters the per-step content.

## Change log

### Batch 1 — Session step clarity + dead-control removal (2026-10-15)

Founder-reported issues addressed:
1. **"Stop processing" did nothing on the web.** It fired `POST processing/revoke` but there is no live capture to stop on the web, so nothing visibly changed. Now the control renders only while native capture is active (`captureActive`); on the web it is gone. Native keeps a working Stop-processing that ends the mic.
2. **Session step showed the transcript panel and the "Add the call" input at the same time.** Now, before a call is added only the input shows; once a call is added only the "Live session" transcript shows, with an **"Add or edit the call"** button to bring the input back on demand. During native capture the transcript shows and the paste/upload input is hidden (capture owns intake). The "Go to the decision" step-forward now appears only once a call exists.
3. **Decision step re-showed the "Add the call" input.** Removed — the call is brought in on the Session step; the Decision step no longer repeats that input.
4. **Decision Map was unexplained.** Added a plain-language lead: "The key points from the call, pulled out one by one. Each is something that was said — not a confirmed fact — so check the source, then confirm or correct it before you decide." Demoted the jargon status line to a small muted caption.

- **Commits:** recorded on commit (DSN-038, Batch 1).
- **Verification:** `apps/web` `tsc --noEmit` clean; `vitest run` 25 files / 225 tests pass (updated SessionScreen + App Session tests for the capture-gated control and the input/transcript toggle; DecisionMap intro worded to avoid colliding with the "Caller claimed" provenance tag).
- **Not re-run:** API suite (web-only); Playwright e2e — see "Open follow-ups".

## Open follow-ups (founder: "we'll work on others next")

- The Decision step still stacks several panels at once (Check public listings, device signals, Confirm fraud, Draft a transfer) — candidate for progressive disclosure / sub-steps. Not yet touched; needs a design pass with the founder.
- Playwright e2e should be re-run before this task is marked done (the journey spec drives the Session → Decision transition; Batch 1 changed when the "Go to the decision" button appears).

## Handoff

- **Next action:** continue polish batches under this record; re-run e2e and move to `done` when the founder is satisfied with the flow.
- **Unresolved issues:** Decision-step decluttering (above) pending design input.
