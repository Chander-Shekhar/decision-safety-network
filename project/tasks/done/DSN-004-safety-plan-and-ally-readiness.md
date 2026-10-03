# DSN-004: Safety Plan and accepted ally readiness

- **Scope:** core
- **Priority:** P0
- **Owner:** DSN-004 implementer subagent (serialized under integrator)
- **Branch/worktree:** `task/DSN-004-safety-plan-and-ally-readiness` @ `.worktrees/dsn-004-safety-plan-and-ally-readiness`
- **Owned paths:** `packages/contracts/src/plan.ts`, `apps/api/src/{plan,ally-pairing,plan-routes}.ts`, `apps/api/test/plan.test.ts`, `apps/web/src/{PlanScreen,PlanScreen.test}.tsx`
- **Dependencies:** DSN-003 (done, integrated @ e560d2d; web test harness @ b66f535)
- **PRD references:** C1 Plan; C12 consent/privacy
- **Decision references:** 0001
- **Started:** 2026-10-03

## Outcome

Saved plan with context-aware threshold, Demo Bank route, four distinct revocable consents, and accepted-ally readiness via short-lived pairing. See plan Task 2 (DSN-004). UI frame 01.

## Boundaries

- Included: `Plan`, `createPlan`, `AllyInvitation`, `hasAcceptedRelationship`, pairing-code + invitation accept/revoke routes, PlanScreen.
- Excluded: case-scoped ally packet/grant (DSN-011). Detail-free initial invitation only.

## Acceptance checks

- [x] Saved plan has threshold, Demo Bank route, four separate consents; UI discloses 24h confirmed-facts default and warns delete-on-close sacrifices no-reentry recovery.
- [x] Pairing rejects self/expired/reused codes; invitation reveals no case data; nomination ≠ readiness until accepted; only nominated ally accepts; revocation removes readiness next request.
- [x] Red→green per plan Task 2; `test:api -- plan.test.ts` + `test:web -- PlanScreen.test.tsx` + `typecheck` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits (final, on `task/DSN-004-safety-plan-and-ally-readiness` after an integrator leak-scrub rewrite):**
  - `9edac6a` — "DSN-004: add safety plan and ally readiness" (unchanged original feature commit).
  - `829e189` — "DSN-004: enforce single-active-ally invariant and record verification" (the re-nomination authz fix + its regression test + verification evidence/handoff). This single leak-free commit **replaces** three earlier branch commits — `bf24c3b` (verification/handoff), `007357f` (re-nomination fix), `d6f658c` (record update) — which were squashed and rewritten out of branch history by the integrator because `bf24c3b` had recorded an absolute local JDK path in the task file. The rewritten tree is byte-identical to the reviewed tip (`git diff d6f658c 829e189` empty); the pre-rewrite commits are now unreachable and were never merged or published.
  - **Re-nomination authz fix:** `createInvitation` revokes every existing non-revoked invitation for the owner (query shape identical to `hasAcceptedRelationship`) after `consumePairingCode` validates and before creating the new invitation, so a stale accepted invitation can no longer keep `hasAcceptedRelationship(owner, oldAlly)` true after re-nomination; an invalid code revokes nothing. Covered by a dedicated regression test.
- **Integration commit:** `0564d69` — "DSN-004: integrate safety plan and ally readiness" (`--no-ff` merge of the rewritten `task/DSN-004-...` into local `main` after independent read-only review APPROVED, including a scoped re-review of the re-nomination fix).
- **Commands and results:**
  - RED gate (pre-implementation): `firebase emulators:exec --project demo-dsn --only auth,firestore 'npm run test:api -- plan.test.ts'` → failed with `Error: Cannot find module '../src/plan.js'` (expected — module did not exist yet). `test:web -- PlanScreen.test.tsx` → failed with `Failed to resolve import "./PlanScreen"` (expected — component did not exist yet).
  - GREEN gate (post-implementation, re-run after the re-nomination fix), run as one chained command with `JAVA_HOME` set to a local JDK 21 (path not committed) and prepended to `PATH`:
    `firebase emulators:exec --project demo-dsn --only auth,firestore 'npm run test:api -- plan.test.ts' && npm run test:web -- PlanScreen.test.tsx && npm run typecheck && git diff --check`
    - `test:api -- plan.test.ts`: **21/21 passed** (`Test Files 1 passed (1)`, `Tests 21 passed (21)`), emulator script exited 0.
    - `test:web -- PlanScreen.test.tsx`: **10/10 passed** (`Test Files 1 passed (1)`, `Tests 10 passed (10)`).
    - `npm run typecheck` (workspaces: `@dsn/contracts`, `@dsn/api`, `@dsn/web`, each `tsc --noEmit -p tsconfig.json`): no errors, all three exited 0.
    - `git diff --check`: exit 0, no output (clean — no whitespace/line-ending issues).
  - Full `apps/api` suite also re-run earlier during implementation to confirm no regressions in foundation tests: 37/37 passed.
- **Post-integration verification:** On integrated `main` @ `0564d69` (JAVA_HOME set to a local JDK 21, path not committed; `--project demo-dsn`): `npm ci` → OK (installed from the committed lockfile, no lockfile change); `npm run typecheck` → exit 0 across `@dsn/contracts`, `@dsn/api`, `@dsn/web`; `npx firebase emulators:exec --only auth,firestore 'npm run test:api'` → **Test Files 3 passed (3), Tests 38 passed (38)** (17 foundation case-store/auth + 21 plan/ally), emulator script exited 0; `npm run test:web` → **Test Files 1 passed (1), Tests 10 passed (10)**; `git diff --check` → clean; `git status` → clean working tree. (Benign offline `MetadataLookupWarning` from GCP metadata probes; emulator uses local auth. A pre-existing user-level npmrc `always-auth` warning referencing a workplace proxy is emitted by npm but does not affect the project `.npmrc`, which targets the public registry, nor the committed lockfile.)
- **Changed paths:** `packages/contracts/src/plan.ts`, `apps/api/src/plan.ts`, `apps/api/src/ally-pairing.ts`, `apps/api/src/plan-routes.ts`, `apps/api/test/plan.test.ts`, `apps/web/src/PlanScreen.tsx`, `apps/web/src/PlanScreen.test.tsx` — all newly added, no existing files touched (foundation files from DSN-003 read-only, untouched).
- **Limitations or skipped checks:** No new npm dependency was needed. `app.ts`, `firestore.rules`, `firebase.json`, and other serialized/root files were not modified — new domain errors (`PAIRING_CODE_NOT_FOUND`, `PAIRING_CODE_EXPIRED`, `PAIRING_CODE_CONSUMED`, `SELF_NOMINATION`) are caught and replied to locally in `plan-routes.ts`; reused shared-vocabulary errors (`FORBIDDEN`, `NOT_FOUND`, `PLAN_REQUIRED`) bubble up to the existing unmodified `STATUS_BY_ERROR_MESSAGE` map in `app.ts`.
  - **Accepted MVP review notes (non-blocking, confirmed by both review passes):**
    - Domain functions in `plan.ts`/`ally-pairing.ts` use `new Date()` directly rather than the injected `ApiDeps.now()`. Consistent within these modules; the expired-code test advances state by rewriting `expiresAt` in Firestore rather than a clock. Harmless for correctness; a later consistency pass could route these through `deps.now()`.
    - Pairing-code consumption and invitation creation are not a single transaction (`consumePairingCode` is its own transaction; the revoke-priors `Promise.all` and `ref.create`/`planRef.set` run after it). Two *concurrent* `createInvitation` calls for the same owner could momentarily leave two active invitations; a single owner realistically does not race their own nomination, and this is not materially worse than the pre-existing non-atomic consumption. Acceptable for the single-ally Core MVP; revisit if multi-device concurrent nomination becomes a scenario.
  - **Route mounting:** `plan-routes.ts` exports a `RouteInstaller` verified in isolation via `buildApi([...], deps)`. Wiring it into the production `app.ts` route list is a serialized-`app.ts` edit owned by a later composition/integration step, not this task.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Done — integrated into local `main` @ `0564d69` and verified. Unblocks DSN-005 (controlled intake/simulation session) and later ally-sharing work (DSN-011) which depends on `hasAcceptedRelationship`.
- **Unresolved issues:** None blocking. The two accepted MVP review notes above (direct `new Date()`; non-atomic code-consumption + invitation create) are deferred by design for the Core MVP. Production `app.ts` route mounting remains a later serialized composition step.
