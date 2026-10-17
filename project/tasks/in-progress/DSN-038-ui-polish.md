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
- **Last updated:** 2026-10-17

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

### Batch 9 — condense the Decision Map: label-forward rows, hover View source (2026-10-15)

Founder feedback on the read-only map: the inline source block ate the screen when an excerpt was long (and source is low-value — the owner was on the call), the field labels (Claimed identity, Central claim, Requested action) were grayed out when they are the key signal, and the value text was oversized/bold.

1. **View source → corner hover/focus popover.** Replaced the click-to-expand inline block with a small "View source" link in the row's top-right (where the per-fact tag used to sit). The excerpt now appears in a width/height-bounded `role="tooltip"` popover on hover or keyboard focus (`SourceHover`, built with Tailwind `group-hover`/`group-focus-within` — no new dependency, no modal, so no Batch 5 freeze). Long excerpts scroll inside the popover instead of pushing the facts apart.
2. **Label is the hero.** Field labels are now full-color and `font-semibold` (`text-text`), not muted gray — they tell the owner *what* each fact is. The value renders calm: `text-base font-normal` (no longer big/bold), so the row reads "this is the **Claimed identity**: Rajesh from the Demo Bank fraud team".
3. **Dropped the per-row "Caller claimed" pill.** It appeared on all ~8 rows and was clutter; the "none of it is independently verified" framing lives once in the map header. A quiet marker remains only for the non-default states a fact can reach — "You corrected this" / "You confirmed what was said" — shown as small muted text, not a pill.

- **Owned paths touched:** `apps/web/src/DecisionMap.tsx`, `apps/web/src/DecisionMap.test.tsx`.
- **Verification:** `apps/web` `tsc --noEmit` clean; `vitest run` 26 files / **233** tests pass (DecisionMap.test updated: header-level claim framing instead of per-row pill, `role="tooltip"` source popover, fallback when a citation resolves to no excerpt).

### Batch 10 — Review step: observations split out, auto caller-verification, fraud control → Recovery (2026-10-17)

Founder: Observed Tactics / Verification Status aren't facts the caller said — they're our read of the conversation, so they should look different; the "Check what the caller said" section was messy with unnecessary text; the caller-org check should run automatically on this step (we have the number on the call path); and "Was this call a scam?" doesn't belong on Review.

1. **Observations split from caller claims.** `DecisionMap` now partitions its facts: genuine extracted claims stay as the label·value fact rows; `observedTactics` + `verificationStatus` render in a distinct, calm **"What we noticed"** highlighted block (info styling, left accent) framed as *our* analysis, not a quote — no "View source", no caller-claim framing. An observation with an `unknown` value is omitted rather than highlighting an empty read. (`OBSERVATION_FIELDS`, `ObservationList`.)
2. **Caller verification runs automatically.** On the **call path** (we have the screened number) the public-listings check against the claimed identity fires automatically on entry to Review (once per case/identity/number, guarded by a ref; skipped if evidence already exists); the result shows under Claimed identity in the map. On the **transcript/upload path** (no number) a single inline "number the caller used" input + **Check** button is offered right there, with the result shown in place. (Vision step 4.)
3. **Decluttered.** Removed the "Check what the caller said" disclosure wrapper and its explanatory paragraphs; the two-paragraph intro and the manual "Check public listings" form are gone from the call path entirely.
4. **"Was this call a scam?" moved to Recovery.** The `ConfirmFraudPanel` (writes the caller to the private warn-list) left Review and now lives in the Recovery/incident phase, shown once the user has entered recovery — matching the vision (save the caller as fraudulent once fraud is being handled), not pre-judged on the facts-review step. Backend `fraud-confirmation` call is unchanged, only relocated.

- **Owned paths touched:** `apps/web/src/DecisionMap.tsx`, `apps/web/src/DecisionMap.test.tsx`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`.
- **Verification:** `apps/web` `tsc --noEmit` clean; `vitest run` 26 files / **235** tests pass (2 new DecisionMap tests for the observations split + the unknown-omission; App Review test updated from the removed "Run a check" disclosure to the inline caller-number verification region).
- **e2e:** no change needed — the `test.fixme` journeys correct `observedTactics` through the consolidated `FactCorrectionPanel` (which still receives all facts) and only assert the Claimed identity / Central claim fact rows.

### Batch 11 — number capture at intake, drop confusing verification status, add procedure check (2026-10-17)

Founder follow-ups on Batch 10: the caller-number input was still on the Review step (they'd asked for it at intake, with the transcript/recording); "Verification status: Unverified" was meaningless; and the vision's procedure-legitimacy call-out ("move your money to a safe account" is not a normal bank process) was missing.

1. **Caller number captured at intake, not on Review.** `SessionInput` now has an optional "Caller's number" field shown with Paste transcript / Upload recording (not the live path, which already has the screened number). It rides along on `onSubmitPaste`/`onSubmitAudio`; `App` stores it as `screenedNumber`, so the Review auto-verification fires for every path. The Review-step number input and its leftover `webCheckNumber` state/effect and the unused `WebEvidenceList` import are gone.
2. **`verificationStatus` dropped from the map.** It is the model's terse note on the caller's verification gap ("Unverified") — uninformative to the owner and duplicating the real automatic public-listings check under Claimed identity. `HIDDEN_FROM_MAP` keeps it off the UI; it still flows to the report/ally packet via the facts projection. "What we noticed" now carries only the observed tactics.
3. **Procedure check added** (vision step 4). `assessProcedure` matches the extracted requested action / tactics / central claim against known coercive-transfer patterns (safe/quarantine account, move money, OTP read-back, remote-access install, gift card, verify-UPI) and, when hit, adds a plain-language "Procedure check" observation: banks/government never ask you to move money to a "safe"/"quarantine" account, read back an OTP, or install an app — a genuine fraud team secures the account on their side. General guidance keyed off the extracted text, framed as our read under "What we noticed", not a verified per-caller claim.

- **Owned paths touched:** `apps/web/src/SessionInput.tsx`, `apps/web/src/SessionInput.test.tsx`, `apps/web/src/DecisionMap.tsx`, `apps/web/src/DecisionMap.test.tsx`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`.
- **Verification:** `apps/web` `tsc --noEmit` clean; `vitest run` 26 files / **238** tests pass (SessionInput: caller-number passed with the transcript; DecisionMap: tactics-only observation, verificationStatus hidden, procedure-check flag, empty-block omission; App Review test no longer expects the removed verify region).
- **e2e:** no change — the `test.fixme` journeys don't drive the web-check UI and the paste path's caller number is optional.

### Batch 12 — Decide step: focused help paths, drop empty/OTP framing (2026-10-17)

Founder on the live Decide screen: "Why slow down?" rendered with nothing under it (its content belongs on the previous Review step, as calming context); the card title "Before you enter an OTP" is wrong (there may be no OTP); and the whole intro paragraph ("Based on what you reviewed, choose what to do…") is unneeded. The step is the decision moment — show, simply, what the owner can do now.

1. **Dropped the "Before you enter an OTP" card wrapper and the empty "Why slow down?" header.** `ActionConsole` no longer wraps everything in a titled `Card`; the step heading "Decide what to do" (from the stepper) is the only title.
2. **Two focused help paths as cards.** The primary action is **"Ask {ally name} for help"** — "Share this call with your Safety Ally. They'll reach out so you don't have to handle it alone — take a breather." (primary button "Ask my ally"). The secondary is **"Verify officially"** — "Reach the real organisation yourself, using a number you look up — never a number the caller gave you." (secondary button "Verify officially"). App passes the sample ally's name (`Priya Nair`) when the sample ally is active, else a generic label.
3. **Removed the verbose App-level intro paragraph** on the Decide section; the cards carry their own one-line reassurance.
4. **Stop-transfer controls self-gate on an open payment.** Pause / Cancel / Continue (+ the Pause-phase acknowledgment gate) now render only when a payment draft exists (e.g. revisiting Decide after Pay), under a calm "There's a transfer waiting on your decision" heading with the ≤3 grounded reasons — not an always-present empty block. Backend semantics and the `act()` routing are unchanged; button names ("Pause transfer", "Cancel transfer", "Verify officially", "Ask my ally", "Confirm Continue", "Continue the transfer") are unchanged.

Still open (founder will check separately): what "Verify officially" actually does; and moving a short psychologically-calming "why slow down" line onto the **Review** step where the tactics/facts are shown.

- **Owned paths touched:** `apps/web/src/ActionConsole.tsx`, `apps/web/src/ActionConsole.test.tsx`, `apps/web/src/App.tsx`, `apps/web/e2e/journey.spec.ts`.
- **Verification:** `apps/web` `tsc --noEmit` clean; `vitest run` 26 files / **238** tests pass (ActionConsole test for the old "Before you enter an OTP" title rewritten to assert the OTP assumption and simulated stamp are both absent and the stop-transfer decision framing shows).
- **e2e:** attack journey reconciled — the reasons locator moved from the removed `section[aria-label="Why slow down"]` to the console's list items; still `test.fixme` pending the live pass.

### Batch 13 — "What we heard" rename, LLM procedure check, scoped alert-red, single forward action (2026-10-17)

Founder follow-ups: "Decision Map" is a poor name for a step that shows extracted claims + our observations; the procedure check was hardcoded (regex) and must be LLM-driven across scenarios ("I told you many times, do not hardcode"); the "Contradicts public listing" pill and the "What we noticed" manipulation block should use a strong warning red; and "This matches the call — continue" duplicated the footer's "Next: Decide".

1. **Renamed the panel to "What we heard"** (founder-chosen). Card title + region aria-label updated; the status caption dropped its "Decision Map ·" prefix. Pairs with the "What we noticed" observations block below it. (Component/file keep the `DecisionMap` name internally.)
2. **Procedure check is now LLM-produced, not a regex.** Added `procedureCheck` to `REQUIRED_FACT_FIELDS`; bumped the extraction prompt to `facts-extract-v2` and gave Gemini explicit per-field guidance (`EXTRACT_FIELD_GUIDANCE`) for every field — including a procedure-legitimacy judgment that reasons from *this* call, not a keyword list. Deleted the web-side `assessProcedure`/`ILLEGITIMATE_PROCEDURE` regex; `DecisionMap` now just renders the model's `procedureCheck` as an observation alongside `observedTactics`. Recorded as decision 0020. (Confirmed via `fake-gemini.ts` + the server wiring that **observed tactics were already live-LLM** — the fake emits no tactics at all, so a populated "What we noticed" can only be the live model.)
3. **Scoped `alert` red.** New `--color-alert` / `--color-alert-soft` tokens (a deliberate, narrow override of decision 0008's amber-not-red rule). Applied to the `contradicts` web-evidence pill (`STANCE_PILL`) and the "What we noticed" block (border + heading). Decision 0020 covers the override.
4. **One forward action.** Removed the Review-step "This matches the call — continue" button; advancing out of Review (via the footer Next or the stepper) now runs the bulk attest in `goToStep` — leaving the facts uncorrected *is* the attestation. Both `StepRail` and `StepFlowNav` route through `goToStep`.

- **Owned paths touched:** `packages/contracts/src/facts.ts`, `apps/api/src/gemini.ts`, `apps/web/src/DecisionMap.tsx`, `apps/web/src/DecisionMap.test.tsx`, `apps/web/src/VerifyPanel.tsx`, `apps/web/src/ui/tokens.css`, `apps/web/tailwind.config.js`, `apps/web/src/App.tsx` (goToStep + attest fold — note: those App.tsx/e2e edits were swept into the parallel Batch 12 commit `61cf472`), `apps/web/src/App.test.tsx`, `apps/web/e2e/journey.spec.ts`, `project/decisions/0020-*`.
- **Verification:** `apps/web` `tsc --noEmit` clean; `vitest run` 26 files / **238** tests pass. `apps/api` `tsc --noEmit` clean. The emulator-backed `apps/api` suite was **not run here** (no `firebase` CLI in this environment); the change is `REQUIRED_FACT_FIELDS`-driven, which `facts.test` asserts dynamically. Run `npm run test:api` locally to confirm.
- **Follow-up:** the live Gemini smoke (DSN-039 runbook / `npm run smoke:llm`) should be re-run after the prompt-version bump to confirm the model returns a useful `procedureCheck`; the running live dev server must be restarted to pick up v2.

### Batch 14 — "What we heard" opens with a calming slow-down lead (2026-10-17)

Founder: the owner reaches Review mid-stress; the step should deliberately, warmly tell them to slow down — not just list facts — while staying clean and low-text.

1. **Calming lead added.** "What we heard" now opens with an info `Callout`: **"Take a breath — you have time."** + "A real bank or official never rushes you, and nothing happens until you choose. Read over what the caller said, slowly." This is the de-escalation the founder wanted carried over from the old (empty) Decide-step "Why slow down?" header — placed here, where the tactics/facts are, so it does psychological work rather than floating alone.
2. **Trimmed the facts framing** to one line ("Each point below is only what the caller *said* — none of it is independently verified. Open a source to see the exact words.") — kept the "none of it is independently verified" phrasing the DecisionMap test pins.
3. **Dropped the always-on "Live processing" status caption** (jargon clutter on the happy path). A status line now appears **only when extraction is degraded**, reworded to stay actionable: "Live processing degraded — you can still read and correct the points below." (preserves the "failure remains actionable" rule and the live-vs-degraded test, now rewritten to assert the live path is quiet).

- **Owned paths touched:** `apps/web/src/DecisionMap.tsx`, `apps/web/src/DecisionMap.test.tsx`.
- **Verification:** `apps/web` `tsc --noEmit` clean; `vitest run` 26 files / **238** tests pass (the live/degraded status test rewritten: live path shows no caption, degraded shows the reworded, actionable caption).

## Open follow-ups (founder: "we'll work on others next")

- Playwright e2e: re-enable the three `test.fixme` journeys in `apps/web/e2e/journey.spec.ts` and run them against the live stack before this task is marked done. Validate the Pay→Decide auto-recheck timing and the facts-gating on Pay for the no-transcript control (notes inline in the spec).
- Re-run the live Gemini smoke after the `facts-extract-v2` prompt change (Batch 13) before the task is marked done.

## Handoff

- **Next action:** continue polish batches under this record; re-enable + run the e2e journeys and move to `done` when the founder is satisfied with the flow.
- **Unresolved issues:** Playwright e2e journeys reconciled but unrun (`test.fixme`) — see Open follow-ups.
