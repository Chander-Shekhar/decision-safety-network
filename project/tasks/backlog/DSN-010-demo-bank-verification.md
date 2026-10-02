# DSN-010: Completed Demo Bank verification

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** `apps/api/src/{demo-bank-registry,verification,verification-routes}.ts`, `apps/api/test/verification.test.ts`, `apps/web/src/{VerifyPanel,VerifyPanel.test}.tsx`
- **Dependencies:** DSN-009 (reviewable after DSN-009 / Task 7)
- **PRD references:** C7 Demo Bank verification; C9
- **Decision references:** 0001
- **Started:** Not started
- **Last updated:** 2026-10-03

## Outcome

Versioned fictional Demo Bank registry is the only actionable route; completed simulated verification records provenance; caller-supplied contacts rejected. See plan Task 8 (DSN-010). UI frames 04, 05.

## Boundaries

- Included: `DEMO_BANK_REGISTRY`, `VerificationResult`/`VerificationProjection`, `verifyWithDemoBank`, VerifyPanel, verify + registry routes.
- Excluded: ally review (DSN-011). Caller text never supplies route/response. Persistent **Simulated**; no real callback/number authoritative.

## Acceptance checks

- [ ] Only actionable route is versioned fictional registry; caller-provided contacts rejected (400); result records registryVersion/method/time/**Simulated**.
- [ ] After cancel/defer, same case durably records rejected Demo Bank claim + cancelled/deferred simulated transfer, `phase === 'Resolve'`; persistent label, no real-bank claim.
- [ ] Red→green per plan Task 8; `test:api -- verification.test.ts` + `test:web -- VerifyPanel.test.tsx` + `typecheck` pass; `git diff --check` clean.

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

- **Next action:** Blocked on DSN-009 integration.
- **Unresolved issues:** None recorded.
