# DSN-022: Demo-grade UI polish and caveat decluttering

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** None until claimed (expected: `apps/web/src/**`, `apps/web/src/ui/**`, `apps/web/src/index.css`, `apps/web/src/ui/tokens.css`)
- **Dependencies:** None (operates on existing screens); coordinates with DSN-019 (a11y)
- **PRD references:** Part I — UX & Solution Design scorecard; Trust/safety/privacy gates (consolidated simulation disclosure); Core quality bar
- **Decision references:** 0008, 0010
- **Started:** Not started
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

- [ ] A human walks the full journey at ~440px and desktop; screenshots saved and linked.
- [ ] Exactly one persistent simulation disclosure remains; grep confirms the removed caveat strings are gone from `apps/web/src`.
- [ ] Each screen has one visually dominant primary action; no Card-in-Card-in-Card nesting remains.
- [ ] Web test suite green; typecheck clean; no API/contract/state-machine change (empty diff over `apps/api`, `packages/contracts`).
- [ ] Provenance states remain distinguishable by label/glyph (not color alone); NCRP "not submitted" label present.

## Verification evidence

- **Commits:** None
- **Integration commit:** Not integrated
- **Commands and results:** None
- **Post-integration verification:** Not run
- **Changed paths:** None
- **Limitations or skipped checks:** None

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Prepare and claim; this is the founder's top priority for demo quality.
- **Unresolved issues:** None recorded.
