# DSN-038: UI polish (ongoing)

- **Scope:** enhancement — ongoing UX/clarity polish of the owner flow
- **Priority:** P2
- **Owner:** Orchestrator (solo owner — claim + implement + integrate per WORKFLOW "Solo owner")
- **Status:** in-progress (kept open; successive polish changes land under this one task per founder request — do not spin up a new task per tweak)
- **Branch/worktree:** committed directly to `main` in small, test-backed, `DSN-038:`-prefixed commits (lightweight iteration; founder reviews live)
- **Owned paths (this task):** `apps/web/src/App.tsx`, `apps/web/src/SessionScreen.tsx`, `apps/web/src/DecisionMap.tsx`, `apps/web/src/journey.ts`, `apps/web/src/ui/Disclosure.tsx`, `apps/web/src/ui/Dialog.tsx`, `apps/web/src/ui/StepRail.tsx`, `apps/web/src/ui/StepFlowNav.tsx`, `apps/web/src/ui/index.ts`, `apps/web/e2e/journey.spec.ts`, and their tests; `project/decisions/0016-ally-preview-promotes-selected-evidence.md` (addendum); this record. (Declare more as batches touch them.)
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

### Batch 3 — Sequential journey navigation (2026-10-15)

The journey had only the StepRail (a jump list) and breadcrumbs; there was no obvious one-step-at-a-time path, so the 7 steps didn't read as a flow (founder: "it should be a multi step flow with back nav possible").

- Added `ui/StepFlowNav` — a Back / Next footer rendered below the step content wherever the StepRail shows. It moves one step at a time through the journey order: "Back to <prev>" always returns; "Next: <next>" is disabled with the gate's reason shown until the next step's prerequisite is met, so you can't skip a lock. A "Step N of 7" indicator sits between them. The StepRail stays as the overview/jump control; this is the linear path.
- Footer labels are prefixed ("Back to …" / "Next: …") so they don't collide with the StepRail's bare step-name buttons that tests select by `/^Session/` etc.

- **Verification:** `apps/web` tsc --noEmit clean; `vitest run` 26 files / **230** tests pass (3 StepFlowNav unit tests + 1 App test driving Session → Decision → Session through the footer).

### Batch 4 — split Decision into Review / Decide / Pay + drop the redundant inline button (2026-10-15)

Two founder directives: "Don't put 2 buttons… keep the one consistently available on all screens" and "definitely break into 3 separate steps."

1. **Removed the Session step's inline "Go to the decision" button.** Moving on is now handled solely by the consistent Back/Next footer (`StepFlowNav`), so there is one forward affordance, present on every step.
2. **Split the single `Decision` step into three sequential steps** in `journey.ts`: **Review** (Decision Map + on-device signals + the optional check tools behind a `Disclosure`), **Decide** (the `ActionConsole` as its own screen), **Pay** (the transfer-draft form + `PaymentPanel` shown directly — the Pay-step `Disclosure` wrapper was dropped since paying is the whole point of the step). Journey order is now Plan → Session → **Review → Decide → Pay** → Verify → Ally → Recovery → Evidence (9 steps). Pay precedes Verify because `canVerify` requires a payment phase of Check/Pause.
3. **Gating:** Review unlocks on `caseId`; Decide/Pay/Verify/Ally unlock on `factsExtracted`. `initialStep` for a loaded case is now `Review`; `CasesScreen` "open current" lands on `Review`.

- **Verification:** `apps/web` `tsc --noEmit` clean; `vitest run` 26 files / **230** tests pass (journey.test, StepFlowNav.test mock array, and the App split/footer tests updated to Review/Decide/Pay and "Step N of 9").
- **e2e:** `apps/web/e2e/journey.spec.ts` **structurally reconciled** to the split (call added on Session; Decision Map on Review; transfer on Pay; console on Decide) but the three UI journeys are marked `test.fixme` and were **not run** against the live stack — the emulator+Vite+API boot is deferred per founder ("we'll run the playwright e2e later"). The api-auth-guard test is unaffected and stays active. Re-enable + validate in the deferred e2e pass; likely tweak point is the Pay→Decide hop (post-submit auto-recheck must settle to `Pause` before the Decide console is read) and the no-transcript legitimate-control draft (Pay is facts-gated).

### Batch 5 — Ally step: fix the modal freeze + auto-generate the summary (2026-10-15)

Founder-reported, testing the live flow: (1) clicking "Preview what my ally would see" froze the whole app — nothing clickable or scrollable, burger included; (2) "why ask a person under stress to select the exact excerpts — a summary should be generated and shown in preview."

1. **Freeze (root cause):** `ui/Dialog` content had no height bound and Radix locks body scroll while a modal is open, so the tall ally packet overflowed off-screen with the close button unreachable — modal behaviour + no way out reads as a frozen app. Fixed `ui/Dialog` with `max-h-[85vh] overflow-y-auto` (defensive for any modal).
2. **Auto-summary (the real fix for this flow):** the Ally step now **auto-generates** the summary on entry and renders the `AllySharePreview` packet **inline** (no modal). No stress-time excerpt triage: a default selection (all excerpts, capped at `MAX_ALLY_EVIDENCE`) is promoted + summarised automatically; the owner reviews and consents by **Share**. The `AllyEvidenceSelector` picker is retained but demoted to an optional "Adjust which excerpts your ally sees" disclosure that re-runs the generation. "Not now" now navigates back to Decide instead of closing a modal.
3. Privacy model unchanged (PRD C8): preview shows exactly what will be sent, full transcript stays private, grant still binds to the previewed version+hash. Recorded as an addendum on decision 0016.

- **Verification:** `apps/web` `tsc --noEmit` clean; `vitest run` 26 files / **230** tests pass (no owner-Ally-step unit test exercises the auto-generate effect; `AllyEvidenceSelector.test.tsx` still covers the picker in isolation).
- **e2e:** attack-journey ally section updated to the inline "Ask my ally preview" region (region role, no dialog); still `test.fixme` pending the live run.

### Batch 6 — compact horizontal stepper (2026-10-15)

Founder: the vertical `StepRail` (a full-width list of all 9 step names + lock reasons) took almost the whole screen and is "of no use to the customer." Replaced it with a compact horizontal progress stepper (per the founder's reference image): one small numbered circle per step connected by a thin line — completed steps show a check and a filled/connected line, the current step is ringed, upcoming/locked steps are muted outlines. No visible step labels (the step name is now the button's accessible name + tooltip, and the Back/Next footer already names the adjacent steps in words). Lock reasons moved from inline rail text to the tooltip/screen-reader label.

- Accessible name per circle stays the exact step name (plus a status suffix only when current/locked), so existing `/^Review/`-style selectors and the available-and-not-current exact `Verify` selector keep matching.
- **Verification:** `apps/web` `tsc --noEmit` clean; `vitest run` 26 files / **230** tests pass (no selector changes needed).

### Batch 7 — wire the public-listings check: visible input + in-place result (2026-10-15)

Founder: the "Number the caller is using" input was invisible until focused, and clicking "Check public listings" seemed to do nothing (the network call ran and returned evidence, but the UI didn't show it — so they clicked three times, producing three identical rows).

1. **Invisible input:** the `<input>` had no className, so Tailwind preflight left it borderless. Gave it the standard field styling (`rounded-md border border-border bg-surface-raised px-space-3 py-space-2`) and wrapped it in the shared `Field` for a proper stacked label + a `+91…` placeholder.
2. **No visible feedback:** the returned evidence only rendered inside `DecisionMap` under the Claimed-identity fact card — above the form and off-screen. Now `WebEvidenceList` also renders **inline right below the form**, so the result appears where the action happened (it still also attaches to the claim in the map). Added a hint when the check is disabled because the claimed identity isn't set yet.
3. **Duplicate rows:** re-running the check appends an identical row server-side; `loadWebEvidence` now collapses content-identical results so each distinct finding shows once.

- **Verification:** `apps/web` `tsc --noEmit` clean; `vitest run` 26 files / **230** tests pass.

### Batch 8 — Decision Map goes read-only; "Confirm" endorsement removed; View source fixed (2026-10-15)

The founder asked what the Decision Map is for and why it demanded inputs, and caught a genuine trust inversion: a per-fact **"Confirm claimed identity"** button reads as *endorsing the caller's claim* ("I'd never confirm that — I don't know if they're right"). The map's job is the opposite: show the call as a short list of discrete, **unverified** claims to inspect, not a form to complete. Real Gemini improved the extracted content but the form-shaped layout (every one of ~8 facts carrying an always-open "Correct …" input + a Confirm button) still read as a ~24-input chore.

1. **Read-only map.** `DecisionMap` is now purely presentational: label · value · provenance tag (`Caller claimed` / `You confirmed what was said` / `You corrected this`) · uncertainty · inline **View source**. The per-fact Correct inputs and per-fact Confirm buttons are gone. Intro reworded to state plainly that each point is only what the caller *said* and none of it is independently verified.
2. **"Confirm" endorsement removed.** No per-fact confirm. The step's single primary action — **"This matches the call — continue"** — bulk-attests the model-extracted facts (promoting `origin: 'model'`, known-value, source-linked facts into the trusted `confirmed` map so the Pause's conversation signals and the ₹1930 report draft still work) and advances to Decide. Framed as *accuracy of capture*, never endorsement of the claim. Backend semantics are unchanged — `confirmFact` already means "affirms what was said" (`fact-validator.ts:357`); only the owner-facing framing/wording changed. Each confirm is version-gated, so the handler runs them sequentially, bumping the expected version per hop (both `confirmFact` and `correctFact` do `version + 1`).
3. **One consolidated correction path.** A single on-demand **"Not right? Correct it"** disclosure (collapsed by default) reveals one input per fact (placeholdered with the current value); the owner fixes as many as needed and applies them in one batch (`FactCorrectionPanel`). This is the PRD line 773 "that is not what happened" path, now an exception rather than a per-row chore. Corrections write `user-corrected` (already trusted), so they don't need the attest step.
4. **View source was dead.** The button called an `onViewSource` prop that App never passed → nothing happened. Now the map resolves a fact's cited segment ids to the live transcript excerpts and reveals them **inline** (speaker + text) on demand — no modal, so no repeat of the Batch 5 freeze.

- **Owned paths touched:** `apps/web/src/DecisionMap.tsx`, `apps/web/src/DecisionMap.test.tsx`, `apps/web/src/App.tsx`, `apps/web/e2e/journey.spec.ts`.
- **Verification:** `apps/web` `tsc --noEmit` clean; `vitest run` 26 files / **233** tests pass (DecisionMap.test rewritten for the read-only component + the new `FactCorrectionPanel`; adds inline View-source reveal, multi-correction apply, and the "confirmed = what was said, not endorsement" labeling).
- **e2e:** the attack + near-neighbor `test.fixme` journeys updated to the new Review controls (consolidated correction panel, "This matches the call — continue" attest button) in place of the per-fact Correct/Confirm; still `test.fixme` pending the live pass.

## Open follow-ups (founder: "we'll work on others next")

- Playwright e2e: re-enable the three `test.fixme` journeys in `apps/web/e2e/journey.spec.ts` and run them against the live stack before this task is marked done. Validate the Pay→Decide auto-recheck timing and the facts-gating on Pay for the no-transcript control (notes inline in the spec).

## Handoff

- **Next action:** continue polish batches under this record; re-enable + run the e2e journeys and move to `done` when the founder is satisfied with the flow.
- **Unresolved issues:** Playwright e2e journeys reconciled but unrun (`test.fixme`) — see Open follow-ups.
