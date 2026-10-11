# DSN-022: Demo-grade UI polish and caveat decluttering

- **Scope:** core
- **Priority:** P0
- **Owner:** Orchestrator (subagent-driven implementer under integrator)
- **Branch/worktree:** `task/DSN-022-ui-polish-declutter` (isolated worktree)
- **Owned paths:** `apps/web/src/**` (all screens, `ui/**`, `index.css`, `ui/tokens.css`). Serialized/not owned: no `apps/api/**`, no `packages/contracts/**`.
- **Dependencies:** None (operates on existing screens); coordinates with DSN-019 (a11y)
- **PRD references:** Part I — UX & Solution Design scorecard; Trust/safety/privacy gates (consolidated simulation disclosure); Core quality bar
- **Decision references:** 0008, 0010
- **Started:** 2026-10-11
- **Last updated:** 2026-10-11

## Outcome

A presentable, confident, demo-grade web journey: scattered defensive caveats collapse to one consolidated honesty disclosure plus two load-bearing screen-local labels; clear visual hierarchy and one primary action per screen; flattened card nesting. No API contract, state-machine, or safety-semantics change.

## Boundaries

- Included: design-system/token upgrade, header disclosure consolidation, badge/caveat removal per the audit cut-list below, action-hierarchy fixes, card-nesting flattening, a human visual walkthrough at ~440px and desktop with screenshots.
- Excluded: a11y acceptance (DSN-019); any route/state/contract change; new scope features (DSN-023..029).

## Audit cut-list (source: UI audit, 2026-10-11; file:line in `apps/web/src/`)

- Remove the `SIMULATED`/`SIMULATED PAYMENT` dashed-purple badge from every panel (PaymentPanel, VerifyPanel ×2, ActionConsole, AllySharePreview, AllyScreen, EvidenceScreen) and the transfer-draft labels.
- `App.tsx:134-141`: collapse the two header caveat paragraphs into one slim banner: **"Prototype — Demo Bank and the transfer are simulated; all data is synthetic."**
- Drop "simulated" from action labels/titles: "Pause transfer", "Cancel transfer", "Save transfer", "Transfer cancelled".
- `DecisionMap.tsx`: cut `:106`, `:160` ("Not independently verified."), `:162` ("Certainty:"), `:171` ("Source not retained" badge). Keep provenance as a quiet inline tag/glyph (PRD "Provenance is not truth" — states must stay distinguishable by label/glyph, not color).
- Payment/Verify: cut `PaymentPanel.tsx:92,122,131` and `VerifyPanel.tsx:66,114`; replace `:110/:116` with one line "Safety check unavailable — choose an action". Cut VerifyPanel badges + Registry-version/Checked-at rows; keep one result line.
- `ActionConsole`: one primary action (Pause), Cancel secondary, Verify/Ally as text links.
- Flatten nesting: drop the outer `App.tsx:167` Card; DecisionMap facts as a plain list.
- Recovery: ~7 cards → 3–4; drop the loud "SIMULATED BANK ROUTE" / "REAL PUBLIC ROUTE" uppercase badges but keep a **subtle** "official" marker on the 1930 route (wireframe mandates equal weight; real 1930 is not simulated); title "Notes".
- Evidence: keep the NCRP label shortened to **"Draft for your review — not submitted."**; cut the SIMULATED badge; fold retention into a footnote.
- DeviceSignalList: cut the "a claim, not a verified fact" callout and per-item badge.

## Load-bearing honesty to PRESERVE

One header banner (above) + "Draft for your review — not submitted" on the NCRP export + one Simulated marker on the final transfer result + distinguishable per-fact provenance.

## Acceptance checks

- [~] A human walks the full journey at ~440px and desktop; screenshots saved and linked. — **Founder action, open.** Local walkthrough steps handed off below; browser tooling here is https-only and cannot screenshot localhost.
- [x] Exactly one persistent simulation disclosure remains; grep confirms the removed caveat strings are gone from `apps/web/src`. — one header banner retained; removed SIMULATED badge strings and defensive paragraphs verified absent by source-level audit + inverted-to-absence tests.
- [x] Each screen has one visually dominant primary action; no Card-in-Card-in-Card nesting remains. — ActionConsole Pause primary / Cancel secondary / Verify+Ally links; outer App Card dropped; DecisionMap flat list.
- [x] Web test suite green; typecheck clean; no API/contract/state-machine change (empty diff over `apps/api`, `packages/contracts`). — 148/148 web tests pass; typecheck clean across contracts/api/web; `git diff cdbe63c..f54c581 -- apps/api packages/contracts` empty.
- [x] Provenance states remain distinguishable by label/glyph (not color alone); NCRP "not submitted" label present. — quiet glyph+label provenance (? ✓ ✎), quiet uncertainty tag ("Unconfirmed"/"Low confidence"), quiet "Source not retained" marker, "Draft for your review — not submitted." on NCRP export.

## Verification evidence

- **Commits:** `185af4d` (polish + caveat declutter), `f54c581` (restore quiet uncertainty / source-not-retained / Simulated-result markers + hygiene) on branch `task/DSN-022-ui-polish-declutter`.
- **Integration commit:** `1bfd4d2` — `git merge --no-ff` into local `main` (not pushed).
- **Commands and results:** `npm run typecheck` → clean across `@dsn/contracts`, `@dsn/api`, `@dsn/web`. `npm --workspace apps/web run test` → 15 files, 148/148 tests pass.
- **Post-integration verification:** Both commands rerun on merged `main` (`1bfd4d2`): typecheck clean, 148/148 pass. api/contracts diff over the delta is empty.
- **Independent review:** `dsn022-review` (read-only, functional-criteria based) — verdict "READY TO INTEGRATE" on `f54c581`; three elevated PRD-honesty items (quiet uncertainty from `fact.uncertainty`; "Source not retained" marker; hard-coded quiet "Simulated" on verify result) all restored and confirmed.
- **Changed paths:** `apps/web/src/**` only — screens (App, DecisionMap, ActionConsole, PaymentPanel, VerifyPanel, RecoveryScreen, EvidenceScreen, SessionScreen, PlanScreen, AllyScreen, AllySharePreview, DeviceSignalList), `ui/{Button,Badge,Card,tokens.css}`, `journey.ts`, and matching tests. No `apps/api`, no `packages/contracts`.
- **Limitations or skipped checks:** The ~440px/desktop human visual walkthrough with screenshots is an open founder action — the browser tool in this environment is https-only and cannot render/screenshot localhost. Local run steps are in Handoff below.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Founder visual walkthrough. Local steps: `npm install` (once) → `npm --workspace apps/web run dev` → open the printed localhost URL; walk the full journey at ~440px (device toolbar) and at desktop width. Checkpoints: one slim header banner, Pause as the single dominant action, flat fact list with quiet provenance/uncertainty tags, equal-weight 1930 "official route" marker, "Draft for your review — not submitted." on the evidence export, one "Simulated" marker on the final transfer result.
- **Unresolved issues:** None blocking. Visual walkthrough + founder sign-off awareness of the `6f105aa` scope amendment remain open founder actions; neither blocks integration or downstream tasks.
