# DSN-004: Safety Plan and accepted ally readiness

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** `packages/contracts/src/plan.ts`, `apps/api/src/{plan,ally-pairing,plan-routes}.ts`, `apps/api/test/plan.test.ts`, `apps/web/src/{PlanScreen,PlanScreen.test}.tsx`
- **Dependencies:** DSN-003
- **PRD references:** C1 Plan; C12 consent/privacy
- **Decision references:** 0001
- **Started:** Not started
- **Last updated:** 2026-10-03

## Outcome

Saved plan with context-aware threshold, Demo Bank route, four distinct revocable consents, and accepted-ally readiness via short-lived pairing. See plan Task 2 (DSN-004). UI frame 01.

## Boundaries

- Included: `Plan`, `createPlan`, `AllyInvitation`, `hasAcceptedRelationship`, pairing-code + invitation accept/revoke routes, PlanScreen.
- Excluded: case-scoped ally packet/grant (DSN-011). Detail-free initial invitation only.

## Acceptance checks

- [ ] Saved plan has threshold, Demo Bank route, four separate consents; UI discloses 24h confirmed-facts default and warns delete-on-close sacrifices no-reentry recovery.
- [ ] Pairing rejects self/expired/reused codes; invitation reveals no case data; nomination ≠ readiness until accepted; only nominated ally accepts; revocation removes readiness next request.
- [ ] Red→green per plan Task 2; `test:api -- plan.test.ts` + `test:web -- PlanScreen.test.tsx` + `typecheck` pass; `git diff --check` clean.

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

- **Next action:** Blocked on DSN-003 integration.
- **Unresolved issues:** None recorded.
