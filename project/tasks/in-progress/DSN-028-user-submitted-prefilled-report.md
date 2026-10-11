# DSN-028: User-submitted, pre-filled 1930/NCRP report

- **Scope:** core
- **Priority:** P1
- **Owner:** Orchestrator (subagent-driven implementer under integrator)
- **Branch/worktree:** `task/DSN-028-user-submitted-prefilled-report` (isolated worktree)
- **Owned paths:** `apps/api/src/{export,recovery}*` + a new report module + their tests, additive `packages/contracts/src/**` (new report contract), `apps/web/src/EvidenceScreen.tsx` (+ its tests). Serialized/not owned: no state-machine/policy/payment/verification/plan/ally change; the DSN-024 `authority-report` fraud-list basis is wired via the existing `fraud-confirmation` route (do not rewrite `fraud-list.ts`/`screening*`).
- **Dependencies:** DSN-022 (done); DSN-024 (fraud-list `authority-report` basis — done, server-side).
- **PRD references:** Part I — Decision 18; C11; Trust gate (NCRP field-map, label until submitted); non-goal (no unattended submission)
- **Decision references:** 0005, 0010
- **Started:** 2026-10-12
- **Last updated:** 2026-10-12

## Outcome

The evidence handoff produces a source-dated, pre-filled official 1930/NCRP form the user reviews and submits themselves through the official channel, replacing the "preview only" framing. Unsupported fields stay blank; the product never submits on the user's behalf and never claims acceptance.

## Boundaries

- Included: pre-filled form generation from confirmed case facts, review UI, one-tap handoff to the official channel for the user to submit, "Draft for your review — not submitted" labeling, recovery-scam warning.
- Excluded: any unattended/background submission; claiming a report was filed or accepted; fabricating unknown fields.

## Acceptance checks

- [ ] The export opens a pre-filled, user-reviewable form populated only from confirmed facts; unknowns blank.
- [ ] Nothing is submitted without an explicit user action in the official channel; label reads "not submitted" until the user acts.
- [ ] No fabricated fields; provenance preserved; recovery-scam warning present.
- [ ] API + web suites green; typecheck clean.

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

- **Next action:** Prepare and claim after DSN-022.
- **Unresolved issues:** Exact official-channel handoff mechanism (deep link vs. download-and-upload) to be chosen during implementation.
