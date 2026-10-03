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

- **Commits:**
  - `9edac6a` — "DSN-004: add safety plan and ally readiness" (branch `task/DSN-004-safety-plan-and-ally-readiness`)
  - `bf24c3b` — "DSN-004: record verification evidence and handoff"
  - `007357f` — "DSN-004: revoke prior invitation on ally re-nomination" (fixes an authz gap found in integrator review: `createInvitation` now revokes every existing non-revoked invitation for the owner before creating the new one, so a stale accepted invitation can no longer keep `hasAcceptedRelationship` true for an ally who is no longer the current nomination; adds a regression test)
- **Integration commit:** Not integrated (awaiting integrator review/merge to `main`)
- **Commands and results:**
  - RED gate (pre-implementation): `firebase emulators:exec --project demo-dsn --only auth,firestore 'npm run test:api -- plan.test.ts'` → failed with `Error: Cannot find module '../src/plan.js'` (expected — module did not exist yet). `test:web -- PlanScreen.test.tsx` → failed with `Failed to resolve import "./PlanScreen"` (expected — component did not exist yet).
  - GREEN gate (post-implementation, re-run after the re-nomination fix), run as one chained command with `JAVA_HOME` set to a local JDK 21 (path not committed) and prepended to `PATH`:
    `firebase emulators:exec --project demo-dsn --only auth,firestore 'npm run test:api -- plan.test.ts' && npm run test:web -- PlanScreen.test.tsx && npm run typecheck && git diff --check`
    - `test:api -- plan.test.ts`: **21/21 passed** (`Test Files 1 passed (1)`, `Tests 21 passed (21)`), emulator script exited 0.
    - `test:web -- PlanScreen.test.tsx`: **10/10 passed** (`Test Files 1 passed (1)`, `Tests 10 passed (10)`).
    - `npm run typecheck` (workspaces: `@dsn/contracts`, `@dsn/api`, `@dsn/web`, each `tsc --noEmit -p tsconfig.json`): no errors, all three exited 0.
    - `git diff --check`: exit 0, no output (clean — no whitespace/line-ending issues).
  - Full `apps/api` suite also re-run earlier during implementation to confirm no regressions in foundation tests: 37/37 passed.
- **Post-integration verification:** Not run (not yet merged to `main`).
- **Changed paths:** `packages/contracts/src/plan.ts`, `apps/api/src/plan.ts`, `apps/api/src/ally-pairing.ts`, `apps/api/src/plan-routes.ts`, `apps/api/test/plan.test.ts`, `apps/web/src/PlanScreen.tsx`, `apps/web/src/PlanScreen.test.tsx` — all newly added, no existing files touched (foundation files from DSN-003 read-only, untouched).
- **Limitations or skipped checks:** None. No new npm dependency was needed. `app.ts`, `firestore.rules`, `firebase.json`, and other serialized/root files were not modified — new domain errors (`PAIRING_CODE_NOT_FOUND`, `PAIRING_CODE_EXPIRED`, `PAIRING_CODE_CONSUMED`, `SELF_NOMINATION`) are caught and replied to locally in `plan-routes.ts`; reused shared-vocabulary errors (`FORBIDDEN`, `NOT_FOUND`, `PLAN_REQUIRED`) bubble up to the existing unmodified `STATUS_BY_ERROR_MESSAGE` map in `app.ts`.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Ready for integrator review and merge of `task/DSN-004-safety-plan-and-ally-readiness` (commit `007357f`) into `main`. DSN-003 dependency is satisfied (already integrated per `a02884a`/`e560d2d`); this task is otherwise unblocked.
- **Unresolved issues:** None recorded.
