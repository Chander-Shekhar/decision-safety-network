# DSN-011: Case-scoped Safety Ally review and revocation

- **Scope:** core
- **Priority:** P0
- **Owner:** DSN-011 implementer subagent (serialized under integrator)
- **Branch/worktree:** `task/DSN-011-case-scoped-ally-review` @ `.worktrees/dsn-011-case-scoped-ally-review`
- **Owned paths:** `packages/contracts/src/ally.ts`, `apps/api/src/{ally,ally-routes}.ts`, `apps/api/test/ally.test.ts`, `apps/web/src/{AllySharePreview,AllySharePreview.test,AllyScreen,AllyScreen.test}.tsx`
- **Dependencies:** DSN-009 (done @ fe7b8bb); DSN-013 selected-evidence API (done @ f9e3e90)
- **PRD references:** C8 ally review; C12 authorization/revocation
- **Decision references:** 0001
- **Started:** 2026-10-04
- **Last updated:** 2026-10-04

## Outcome

Owner-side frozen-packet preview + explicit Share grant; minimum allowlisted packet; revocation; ally response without transfer control. See plan Task 9 (DSN-011). UI frames 03b, 04. Also exposes `readSelectedEvidence` dependency ordering with DSN-013.

## Boundaries

- Included: `previewAllyPacket` (no grant), `AllyGrant`, `createGrant`, `revokeGrant`, `readAllyPacket`, `respondAsAlly`, allowlisted `AllyPacket`, preview + grant + ally routes.
- Excluded: evidence promotion/retention internals (DSN-013). Ally cannot call payment commands or certify caller. Three predicates rechecked every read; no cached auth.

## Acceptance checks

- [ ] Ask My Ally opens owner-authenticated preview of exact allowlisted packet + selected excerpts without granting; only explicit Share w/ current preview creates grant; Not now leaves access denied.
- [ ] Accepted+unrevoked ally w/ active sharing consent + grant reads packet; direct-API reads of transcript/unselected evidence/other case/revoked data fail next request; post-share packet-affecting change invalidates until re-preview/re-share; frozen snapshot only.
- [ ] Red→green per plan Task 9; `test:api -- ally.test.ts` + `test:web -- AllySharePreview.test.tsx AllyScreen.test.tsx` + `typecheck` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits (task branch):** eade972 (red API tests), ce70d21 (ally.ts contract + API + routes), ebdc7ac (red web tests), 1b973de (components), plus the final test-marker rename/task-record commit.
- **Integration commit:** Not integrated
- **Commands and results:**
  - Red API: `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test -- ally.test.ts'` -> suite failed to load (missing `../src/ally.js` / `ally-routes.js`).
  - Green API: same command -> 1 file, 26 passed (16 function-level + 10 HTTP-route tests).
  - Red web: `npm --workspace apps/web run test -- AllySharePreview.test.tsx AllyScreen.test.tsx` -> 2 files failed to resolve components.
  - Green web: same command -> 2 files, 15 passed.
  - Full API regression: 13 files, 313 passed. Full web: 9 files, 95 passed.
  - `npm run typecheck`: no TS errors. `git diff --check`: clean.
- **Post-integration verification:** Not run
- **Changed paths:** `packages/contracts/src/ally.ts`, `apps/api/src/{ally,ally-routes}.ts`, `apps/api/test/ally.test.ts`, `apps/web/src/{AllySharePreview,AllySharePreview.test,AllyScreen,AllyScreen.test}.tsx`, this task record.
- **Limitations or skipped checks:**
  - Dependencies found and reused unchanged: `hasAcceptedRelationship`, `acceptInvitation`, `createInvitation` (apps/api/src/plan.ts), `Plan.allySharingConsent`, `readSelectedEvidence` (retention.ts). No gap.
  - Routes are not mounted in `app.ts`; tested in isolation via `buildApi([createAllyRoutes(), ...], deps)`.
  - Grants live at `cases/{id}/allyGrants/{allyUid}` and responses at `cases/{id}/allyResponses/*`, so `deleteCaseContent` (which lists subcollections) removes them with the case. No case event/version bump is written for Share/revoke/response (grant is self-contained; reads validate by content hash), so no new transition is involved.
  - Packet `claim`/`proposedAction`/`verificationGap` come from confirmed facts, else the model's live fact, else a fixed default; any later correction changes the hash and invalidates the grant (`STALE_GRANT`).
  - Grant TTL is 24h (capped by case expiry); not specified by the plan.
  - Components are presentational; wiring to the API client is DSN-014. No owner-side route to list ally responses exists (not in plan scope).
  - Web tests were not run in a real browser; a second-browser E2E is Task 12/13.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Review, then integrate. Mounting `createAllyRoutes()` into `app.ts` and wiring the components into `App.tsx` is DSN-014 (serialized files).
- **Unresolved issues:** None blocking. Carry-forwards: the `STALE_PREVIEW`/`STALE_GRANT`/`UNKNOWN_EVIDENCE`/`INVALID_*` codes are mapped locally in `ally-routes.ts` (not in `app.ts`); an owner-facing view of ally responses is not yet built.
