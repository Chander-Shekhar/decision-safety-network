# DSN-035: Ally can discover and accept an invitation

- **Scope:** defect
- **Priority:** P1
- **Owner:** Orchestrator (solo owner — claim + implement + integrate per WORKFLOW "Solo owner")
- **Branch/worktree:** `task/DSN-035-ally-invitation-discovery`
- **Owned paths:** `apps/api/src/plan.ts`, `apps/api/src/plan-routes.ts`, `apps/api/test/plan.test.ts`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/PlanScreen.tsx`, `apps/web/src/PlanScreen.test.tsx`, this task record, `project/decisions/0017-*.md`.
- **Dependencies:** DSN-004 (plan + pairing), DSN-034 (`?role=ally` session). Decision 0017.
- **PRD references:** Core MVP Safety Ally pairing.
- **Decision references:** 0017 (ally-keyed invitation discovery endpoint).
- **Started:** 2026-10-15
- **Last updated:** 2026-10-15

## Outcome

A nominated ally, in their own `?role=ally` session, sees an incoming invitation and can accept it; acceptance establishes the real accepted relationship server-side. Reported bug: owner's Settings flipped to "Invited, awaiting acceptance" but the ally session showed no change and "Accept invitation" did nothing.

## Boundaries

- Included: `GET /api/v1/ally/invitations` (ally-keyed, unrevoked only, detail-free); `listInvitationsForAlly`; web ally session polls to discover/reflect the invitation and calls the real accept endpoint; ally pairing UI reflects waiting / invited / connected and only enables Accept when actually invited.
- Excluded: invitation data-model changes; owner-side routes; the DSN-014-blocked auth plumbing (anon emulator auth = one uid per browser context; real pairing still needs two contexts/devices); push/subscription (polling is used).

## Root cause

Every `allyInvitations` read was keyed on `ownerUid`; the ally had no way to learn an invitation's id, and `accept` requires that id. The web ally "Accept" button only set local state and never called the API, and the ally session never fetched invitations (and defaulted `allyStatus` to the owner's sample `'ready'`).

## Acceptance checks

- [x] Server exposes an ally-scoped `GET /api/v1/ally/invitations` returning the authenticated ally's active invitations, excluding revoked and other allies', carrying no case data, and denying unauthenticated requests. — `apps/api/test/plan.test.ts` (`listInvitationsForAlly` + two HTTP tests)
- [x] The web ally session discovers an invitation, reflects it (waiting → invited → connected), and accepts via `POST ally-invitations/:id/accept`. — `apps/web/src/App.test.tsx` (two ally-session tests) + `PlanScreen.test.tsx`
- [x] Accept is inert until an invitation has arrived. — `PlanScreen.test.tsx` + App waiting-state test
- [x] typecheck clean; full unit suites green; e2e unaffected (8/8).

## Verification evidence

- **Commits:** bffe34f (implementation + tests + decision 0017).
- **Integration commit:** 2eaacb3 (`--no-ff` merge of `task/DSN-035-ally-invitation-discovery` into `main`).
- **Commands and results:**
  - `apps/web`: `tsc --noEmit` clean; `vitest run` 24 files / 219 tests pass.
  - `apps/api`: `tsc --noEmit` clean; `vitest run` (under `firebase emulators:exec --only auth,firestore`) 22 files / 425 tests pass.
  - `apps/web` Playwright e2e: 8/8 (desktop + mobile-440).
- **Post-integration verification:** on `main` after the merge — `apps/web` `vitest run` 24 files / 219 tests pass. (API suite + e2e proven on the identical pre-merge branch tree.)
- **Changed paths:** `apps/api/src/{plan,plan-routes}.ts`, `apps/api/test/plan.test.ts`, `apps/web/src/{App,PlanScreen}.tsx`, `apps/web/src/{App,PlanScreen}.test.tsx`, `project/decisions/0017-ally-invitation-discovery-endpoint.md`.
- **Limitations or skipped checks:** API tests require the Firestore/Auth emulators + JDK 21 (invocation env only). Real two-party pairing still needs two browser contexts/devices (DSN-014 auth plumbing unchanged).

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Integrate to `main`; record integration commit + post-integration verification.
- **Unresolved issues:** None recorded.
