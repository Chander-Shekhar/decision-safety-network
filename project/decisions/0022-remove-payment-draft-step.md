# 0022: Remove the owner payment-draft ("Pay") step; "I already paid" moves to Decide

- **Status:** Accepted
- **Date:** 2026-10-17
- **Owners:** Orchestrator / DSN-038
- **Related task:** DSN-038
- **PRD references:** Core MVP C6 (explainable action console / causal acceptance matrix), founder demo vision step 5 ("clear next steps: Ally + Already paid") and step 6 (recovery / incident phase)
- **Supersedes:** The owner-facing payment-draft → submit → recheck flow and the draft-gated enhanced "Pause" as a *journey step* (the policy/engine in `apps/api/src/policy.ts` is untouched; see below)
- **Superseded by:** None

## Context

The owner journey had a dedicated **"Pay"** step ("If you decide to send money") that asked the user to re-enter the transfer the caller demanded — beneficiary + amount — then "submit" it so DSN could re-check the draft. That drafted transfer fed exactly two things:

1. The **enhanced "Pause"** — the hard "stop, this is a scam" state only fires when `isJoined` is true, which requires `largeNewPayee` (a drafted, above-threshold transfer to a new payee). Manipulation *detection* itself (`cues && unverified` → `Check`, the calming "slow down & verify" shown on Review/Decide) is driven by the **call**, not the draft.
2. **Recovery prefill** — and `apps/api/src/recovery.ts`'s `computePrefill` already falls back from `paymentDraft` to the **extracted call facts** (requested action + amount in the transcript), with a manual edit path on top.

The founder's instruction: this screen is not in the vision and makes an already-panicked user enter detail that is barely used. The vision's "clear next steps" (step 5) are **Ally** and **"Already paid"**; the paid-amount detail belongs in the **Recovery / incident phase** (step 6), where it is collected to build the 1930 / cyber-cell case.

## Decision

**Clean removal**, authorised by the founder (authority order #1 over the locked PRD):

- Delete the **Pay** step from the owner journey. `STEPS` is now `Plan → Session → Review → Decide → Verify → Ally → Recovery → Evidence`. Deleted `PaymentPanel.tsx` (+ test) and the draft form, and the `draftPayee`/`newPayeeId`/`draftAmount` state in `App.tsx`.
- Add **"I already paid"** as a path on the **Decide** step's `ActionConsole`, alongside "Ask my ally" and the (DSN-021) "Call the organisation" action. It enters recovery (`POST …/recovery/enter`) and routes to the Recovery step — the same handler the old `PaymentPanel.onAlreadyPaid` used.
- `ActionConsole` is now a pure three-path hub (ally / call / already-paid). The payment-state machinery (`paymentState`, `reasons`, pause/cancel/continue, the ack-gated Continue, the resolved banner) is removed from the component and from the Decide call site.
- Recovery is reached only via "I already paid" (`journey.ts`: `Recovery` gated on `recoveryEntered`, no longer on a drafted payment; `paymentExists` dropped from `JourneyState`). The paid-amount detail is entered on Recovery, prefilled from the extracted call facts when available and otherwise typed manually (`RecoveryScreen` unchanged — it already supports both).
- Verify is no longer gated behind "submit the transfer first": `canVerify` now allows the check as soon as a call's facts are extracted (vision step 4 — a safe, user-initiated claim check), independent of phase. The API's `Observe → Check → Verify` double-hop still enforces legal transitions server-side.

## Consequences

- The stressed owner is never asked to re-draft the caller's demand. Detection remains: the call-driven `Check` warning ("slow down & verify") still appears on Review and the Decide hub.
- **The draft-gated hard "Pause / stop the transfer" ritual is gone from the UI.** `largeNewPayee` is never set by the owner now, so `isJoined` never holds via the UI and the enhanced Pause phase is not reachable in the owner flow. This was a deliberate, founder-approved loss (the "re-derive the hard stop from call facts" option was offered and declined for this iteration).
- `apps/api` payment routes (`payment/draft|submit|recheck`) and the `policy.ts` enhanced-Pause predicate are **left in place but unused by the web UI** — removing them is a larger API/contract change deferred to keep this batch scoped and the API suite green. Flagged as a follow-up.
- The three `test.fixme` Playwright journeys in `apps/web/e2e/journey.spec.ts` still assume the draft/Pay/Pause model; a stale-note was added and they must be rewritten during the deferred live e2e pass.

## Alternatives considered

### Also re-derive the hard "Pause" from the call facts (amount + "move to a safe account" the caller demanded)

Offered to the founder; declined for this iteration. Would keep a forceful "stop" without any user data entry, but is a backend policy change (feed `largeNewPayee`/`matchingRelation` from extracted facts rather than a draft). Left as a possible future enhancement.

### Keep Pay as an optional/hidden step

Rejected: it is not in the vision and the data it collected is either call-derived (detection, recovery prefill) or collected better on Recovery.

## Verification

- `apps/web` `tsc --noEmit` clean; `vitest run` green (24 files / 204 tests; down from 230 after deleting `PaymentPanel.test.tsx`). Rewrote `ActionConsole.test.tsx` (three-path hub, no payment controls), `journey.test.ts` (no `paymentExists`; Verify allowed on extracted facts; Recovery gated on `recoveryEntered`), `StepFlowNav.test.tsx` (8 steps), and two `App.test.tsx` cases (Review→Decide split with no draft form; Verify reachable on facts).
- Not run: the emulator-backed `apps/api` suite (unchanged by this batch — no API files were edited). The payment/recovery/policy backend is untouched.
