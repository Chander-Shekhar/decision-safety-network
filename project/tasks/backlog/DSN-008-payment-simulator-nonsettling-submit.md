# DSN-008: Payment simulator, cross-context bind, non-settling submit

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** `packages/contracts/src/payment.ts`, `apps/api/src/{payment,payment-routes}.ts`, `apps/api/test/payment.test.ts`, `apps/web/src/{PaymentPanel,PaymentPanel.test}.tsx`
- **Dependencies:** DSN-003, DSN-006, DSN-007
- **PRD references:** C4 conversation/payment bind; C5
- **Decision references:** 0001
- **Started:** Not started
- **Last updated:** 2026-10-03

## Outcome

Server-owned new-payee simulator; validated-relation join; submit stays pending until explicit human action; races never auto-settle or fabricate Pause. See plan Task 6 (DSN-008). UI frames 02, 03.

## Boundaries

- Included: `PaymentDraft`/`PaymentState`/`PaymentProjection`, `saveDraft`, `submitIntent`, `recheckRelation`, `applyValidatedRelation`, PaymentPanel, recheck route.
- Excluded: human action commands (DSN-009). Browser never sends `newPayee` or policy result. Payment persistently **Simulated**; intervention before OTP, never a real held/reversed transfer.

## Acceptance checks

- [ ] Server validates amount/beneficiary, derives new-payee; joined intervention needs valid cited conversation + unchanged current draft; payment-only/conversation-only stay proportionate.
- [ ] Every submit pending until explicit human action; changed-draft/late-segment/stale-result/timeout/outage races never auto-complete or fabricate Pause; current valid result can advance pending case through legal states.
- [ ] Red→green per plan Task 6; `test:api -- payment.test.ts` + `test:web -- PaymentPanel.test.tsx` + `typecheck` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

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

- **Next action:** Blocked on DSN-007 integration.
- **Unresolved issues:** None recorded.
