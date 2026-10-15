# DSN-036: Owner sees the ally's acceptance

- **Scope:** defect
- **Priority:** P1
- **Owner:** Orchestrator (solo owner — claim + implement + integrate per WORKFLOW "Solo owner")
- **Branch/worktree:** `task/DSN-036-owner-sees-acceptance`
- **Owned paths:** `apps/api/src/plan.ts`, `apps/api/src/plan-routes.ts`, `apps/api/test/plan.test.ts`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, this task record, `project/decisions/0018-*.md`.
- **Dependencies:** DSN-035 (ally-side discovery + acceptance), decision 0017. Decision 0018.
- **PRD references:** Core MVP Safety Ally pairing.
- **Decision references:** 0018 (owner-keyed invitation read-back endpoint).
- **Started:** 2026-10-15
- **Last updated:** 2026-10-15

## Outcome

After the nominated ally accepts (in their own `?role=ally` session), the owner's session reflects it on its own: the Safety Ally status moves from "nominated, awaiting acceptance" to "Ally ready" without any manual refresh. Reported bug: ally accepted and saw "connected", but the owner (main) session stayed on "awaiting acceptance".

## Boundaries

- Included: `GET /api/v1/owner/invitations` (owner-keyed, unrevoked only, detail-free); `listInvitationsForOwner`; web owner session polls to reflect `invited` → `ready`; a stored `plan.nominatedAllyUid` clears the client-only sample-ally flag on load so the poll runs and reload restores status.
- Excluded: invitation data-model changes; ally-side routes (DSN-035); folding readiness into the plan contract; the DSN-014-blocked auth plumbing (two contexts/devices still required); push/subscription (polling, per 0017/0018).

## Root cause

The mirror of DSN-035, on the owner side. Redeeming a pairing code set `allyStatus = 'invited'` as local state only (`apps/web/src/App.tsx`), and the only invitation-discovery poll was gated to `role === 'ally'`. There was no owner-keyed read of `allyInvitations` and no owner-side poll, so the acceptance written by the ally (`acceptInvitation` → `acceptedAt`, correctly persisted in Firestore) was never read back by the owner session.

## Acceptance checks

- [x] Server exposes an owner-scoped `GET /api/v1/owner/invitations` returning the authenticated owner's active invitations, reflecting acceptance, excluding revoked and other owners', carrying no case data, and denying unauthenticated requests. — `apps/api/test/plan.test.ts` (`listInvitationsForOwner` + two HTTP tests)
- [x] The web owner session polls and reflects `invited` → `ready` when the ally accepts, and shows "awaiting acceptance" while pending. — `apps/web/src/App.test.tsx` (two owner-session tests)
- [x] The sample-ally demo state is preserved (poll runs only once a real nomination clears the sample flag). — gating on `allyIsSample`; verified by the still-green first-run/configured-owner suites.
- [x] typecheck clean; full unit suites green.

## Verification evidence

- **Commits:** ad1672b (implementation + tests + decision 0018).
- **Integration commit:** recorded post-merge below.
- **Commands and results:**
  - `apps/web`: `tsc --noEmit` clean; `vitest run` 24 files / 221 tests pass (was 219; +2 owner-session tests).
  - `apps/api`: `tsc --noEmit` clean; `vitest run` (under `firebase emulators:exec --only auth,firestore`) 22 files / 428 tests pass (was 425; +3 owner-read tests).
- **Changed paths:** `apps/api/src/{plan,plan-routes}.ts`, `apps/api/test/plan.test.ts`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `project/decisions/0018-owner-invitation-readback-endpoint.md`.
- **Limitations or skipped checks:** API tests require the Firestore/Auth emulators + JDK 21 (invocation env only). e2e not re-run — this change adds an owner-side read + poll and does not alter the existing journey the e2e covers. Real two-party pairing still needs two browser contexts/devices (DSN-014 auth plumbing unchanged).

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Integrate to `main`; record integration commit + post-integration verification.
- **Unresolved issues:** None recorded.
