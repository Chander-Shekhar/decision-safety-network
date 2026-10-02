# DSN-011: Case-scoped Safety Ally review and revocation

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** `packages/contracts/src/ally.ts`, `apps/api/src/{ally,ally-routes}.ts`, `apps/api/test/ally.test.ts`, `apps/web/src/{AllySharePreview,AllySharePreview.test,AllyScreen,AllyScreen.test}.tsx`
- **Dependencies:** DSN-009; DSN-013 (selected-evidence read API)
- **PRD references:** C8 ally review; C12 authorization/revocation
- **Decision references:** 0001
- **Started:** Not started
- **Last updated:** 2026-10-03

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

- **Commits:** None
- **Integration commit:** Not integrated
- **Commands and results:** None
- **Post-integration verification:** Not run
- **Changed paths:** None
- **Limitations or skipped checks:** None

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Blocked on DSN-009 + DSN-013 selected-evidence API.
- **Unresolved issues:** Depends on DSN-013 `readSelectedEvidence`; sequence DSN-013 before/with DSN-011.
