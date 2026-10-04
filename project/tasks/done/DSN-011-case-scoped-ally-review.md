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

- [x] Ask My Ally opens owner-authenticated preview of exact allowlisted packet + selected excerpts without granting; only explicit Share w/ current preview creates grant; Not now leaves access denied.
- [x] Accepted+unrevoked ally w/ active sharing consent + grant reads packet; direct-API reads of transcript/unselected evidence/other case/revoked data fail next request; post-share packet-affecting change invalidates until re-preview/re-share; frozen snapshot only.
- [x] Red→green per plan Task 9; `test:api -- ally.test.ts` + `test:web -- AllySharePreview.test.tsx AllyScreen.test.tsx` + `typecheck` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits (task branch, local only):** `eade972` red API tests, `ce70d21` ally.ts contract + API + routes, `ebdc7ac` red web tests, `1b973de` components, `07e25a9` test-marker rename (`SECRET-TRANSCRIPT`→`HIDDEN-TRANSCRIPT`) + task record.
- **Integration commit:** `fe7c7f3` (`--no-ff` merge into local main). Local only; not pushed.
- **Commands and results:**
  - Red API: `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test -- ally.test.ts'` -> suite failed to load (missing `../src/ally.js` / `ally-routes.js`).
  - Green API: same command -> 1 file, 26 passed (16 function-level + 10 HTTP-route tests).
  - Red web: `npm --workspace apps/web run test -- AllySharePreview.test.tsx AllyScreen.test.tsx` -> 2 files failed to resolve components.
  - Green web: same command -> 2 files, 15 passed.
  - Full API regression: 13 files, 313 passed. Full web: 9 files, 95 passed.
  - `npm run typecheck`: no TS errors. `git diff --check`: clean.
- **Post-integration verification (on local main @ `fe7c7f3`):** `npm run typecheck` -> clean (contracts, api, web); `git diff --check` -> clean; full web suite -> 10 files, 109/109; full API emulator suite `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test'` -> 14 files, 339/339; hygiene `git grep -i` over integrated ally files (sfdc/salesforce/chander//Users//repo.local/bazel_jdk/apikey/password/secret) -> no hits; committer identity personal no-reply.
- **Independent review (dsn011-review, read-only):** Verdict **mergeable as-is, no BLOCKING findings**. Reviewer independently confirmed: only the 9 owned paths changed (no serialized file; `plan.ts`/`retention.ts` unchanged read-only reuse); `hasAcceptedRelationship` (plan.ts:126) + `readSelectedEvidence` (retention.ts:392) exist with assumed signatures; per-read re-authorization at `ally.ts:208-232` (owner consent + accepted relationship + grant existence/revocation/expiry + case expiry, nothing cached; unaccepted ally → FORBIDDEN; preview/"Not now" create no grant); packet allowlist `buildAllowlistedPacket` (ally.ts:57-71) returns exactly `ALLY_PACKET_KEYS`, no transcript path; `STALE_PREVIEW`/`STALE_GRANT` fail closed; `respondAsAlly` re-runs `readAllyPacket`, writes only to `allyResponses`, cannot reach payment/certification/case doc; `revokeGrant` nulls snapshot + selection; UI presentational with persistent SIMULATED label. Reviewer re-ran ally API 26/26, web 15/15, web typecheck, `git diff --check` — all clean (did NOT re-run full regression counts or red-first history). Five NON-BLOCKING findings (carry-forwards): (1) share/revoke/respond write no case event / version bump — safe for the projection but PRD C12 says "audit"; revocation survives only as `revokedAt` on the grant doc — flag for founder/DSN-014 whether C12 requires an append-only event; (2) `createAllyGrant` transaction rechecks only case version (consent/relationship/hash checked pre-transaction) so a revocation/evidence-edit in that gap can still store a grant, but it fails closed on next read (FORBIDDEN/STALE_GRANT) — not atomic; (3) `z.uuid()` in zod 4 accepts any RFC-4122 variant, not strictly v4 (consistent with existing caller-key validation in `commitCaseCommand`; a codebase-wide `z.uuidv4()` switch is a DSN-014 decision, not a DSN-011-local change); (4) `IDEMPOTENCY_CONFLICT` is omitted from `ally-routes.ts` `LOCAL_ERROR_STATUS` — reviewer flagged a possible 500. **Integrator-verified resolved:** `app.ts`'s shared `STATUS_BY_ERROR_MESSAGE` already maps `IDEMPOTENCY_CONFLICT: 409`, and `buildApi` installs that shared error handler for every composed app (isolation or mounted), so it returns 409 correctly; no change needed. (5) routes unmounted — DSN-014. (6) `readAllyPacket` (ally.ts:208-248) is not transactional — plan/relationship/grant/case read separately, so a revocation landing mid-read could serve one last packet; within "next request" revocation semantics, benign. (7) `ally-routes.ts:118` passes `request.body as never` — safe because `ResponseSchema` is strict, but a type-cast smell. Full review (verdict + findings 1-7) received across the initial message and a resend; verdict unchanged throughout: mergeable as-is, no BLOCKING.
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

- **Next action:** Done — reviewed and integrated to local main @ `fe7c7f3`. Mounting `createAllyRoutes()` into `app.ts` (incl. mapping `STALE_PREVIEW`/`STALE_GRANT`/`UNKNOWN_EVIDENCE`/`INVALID_*`/`IDEMPOTENCY_CONFLICT` in the shared status map) and wiring the components into `App.tsx` is DSN-014 (serialized files).
- **Unresolved issues:** None blocking. Founder-surface: PRD C12 "audit" interpretation — whether ally share/revoke/respond must emit an append-only case event rather than only `revokedAt` on the grant doc (review finding 1). Carry-forwards to DSN-014: `z.uuidv4()` strictness (finding 3), `IDEMPOTENCY_CONFLICT` status mapping on mount (finding 4), owner-facing ally-response view (not in plan scope).
