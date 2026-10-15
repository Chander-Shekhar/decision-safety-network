# DSN-038: UI polish (ongoing)

- **Scope:** enhancement — ongoing UX/clarity polish of the owner flow
- **Priority:** P2
- **Owner:** Orchestrator (solo owner — claim + implement + integrate per WORKFLOW "Solo owner")
- **Status:** in-progress (kept open; successive polish changes land under this one task per founder request — do not spin up a new task per tweak)
- **Branch/worktree:** committed directly to `main` in small, test-backed, `DSN-038:`-prefixed commits (lightweight iteration; founder reviews live)
- **Owned paths (this task):** `apps/web/src/App.tsx`, `apps/web/src/SessionScreen.tsx`, `apps/web/src/DecisionMap.tsx`, `apps/web/src/ui/Disclosure.tsx`, and their tests; this record. (Declare more as batches touch them.)
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

### Batch 2 — Decision step decluttering (2026-10-15)

The Decision step was a flat stack of seven panels with no hierarchy (founder: "a lot of others… I understand none of them"). Regrouped into a clear read → check → decide → pay flow:

1. **Decision Map** stays at the top (what the call was about).
2. **On-device signals** render only when one has arrived (self-gating; unchanged).
3. **"Check what the caller said"** — the optional investigative tools (public-listings lookup, mark-as-fraud) moved behind a collapsed `Disclosure` with a one-line explanation each, so they're available but not in the way.
4. **"Decide what to do"** — the `ActionConsole` (pause / cancel / continue / verify / ask ally) promoted to its own labelled section as the primary action surface, ahead of payment.
5. **"If you decide to send money"** — the transfer-draft form + `PaymentPanel` moved behind a `Disclosure` that is collapsed by default and auto-opens when a payment draft already exists.

Added an optional `defaultOpen` prop to the shared `ui/Disclosure` (defaults to collapsed; existing SettingsScreen usage unaffected).

- **Verification:** `apps/web` tsc --noEmit clean; `vitest run` 25 files / **226** tests pass (added an App test asserting the console is up front and the checks/payment disclosures are collapsed until opened).

## Open follow-ups (founder: "we'll work on others next")

- **Full multi-step flow pass (next):** apply the Session-step "one thing at a time" treatment across the remaining journey steps so each step reads as a single focused screen with clear forward/back. The Decision step is now grouped but still a long single page; a future pass may split check vs. decide vs. pay into sub-steps.
- Playwright e2e should be re-run before this task is marked done (the journey spec drives the Session → Decision transition; Batches 1–2 changed when the "Go to the decision" button appears and moved the Decision panels behind disclosures).

## Handoff

- **Next action:** continue polish batches under this record; re-run e2e and move to `done` when the founder is satisfied with the flow.
- **Unresolved issues:** Decision-step decluttering (above) pending design input.
