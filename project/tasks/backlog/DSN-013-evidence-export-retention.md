# DSN-013: Evidence, export, retention, and deletion

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** `packages/contracts/src/evidence.ts`, `apps/api/src/{retention,retention-routes,export,evidence-routes}.ts`, `apps/api/test/{evidence,retention}.test.ts`, `apps/web/src/{EvidenceScreen,EvidenceScreen.test}.tsx`
- **Dependencies:** DSN-009 (reviewable after Task 7); provides selected-evidence/retention API to DSN-011, DSN-012
- **PRD references:** C11 evidence/handoff; C12 retention/deletion
- **Decision references:** 0001
- **Started:** Not started
- **Last updated:** 2026-10-03

## Outcome

Evidence promotion + origin-separated timeline; three retention modes via sole close route; recursive deletion w/ unlinkable tombstone; consent-gated ZIP (brief.html/provenance.json/ncrp-preview.html) reviewable preview; expiry + authenticated sweep. See plan Task 11 (DSN-013). UI frame 06.

## Boundaries

- Included: `promoteEvidence`, `readSelectedEvidence`, `closeSessionWithRetention`, `deleteCaseContent`, `sweepExpiredCases`, `buildExportZip`, EvidenceScreen; sole `POST /api/v1/cases/:id/session/close`; `POST /internal/retention/sweep` (scheduler OIDC only).
- Excluded: Cloud Scheduler wiring (DSN-014). Export never a submitted report; caller claim never shown as verified bank fact; proposed never fills actual-paid.

## Acceptance checks

- [ ] All three retention modes pass through sole close route; confirmed-only default removes raw/unselected/grants/identifying events; selected-7d retains only chosen excerpts; interrupted close retry converges.
- [ ] Export requires active consent; HTML brief + provenance JSON + source-dated NCRP preview, unknown fields blank, "not submitted or accepted" copy; immediate deletion removes all descendants + unlinkable tombstone; expiry blocks reads; authenticated sweep removes data; Firebase token cannot invoke sweep.
- [ ] Red→green per plan Task 11; `test:api -- evidence.test.ts retention.test.ts` + `test:web -- EvidenceScreen.test.tsx` + `typecheck` pass; `git diff --check` clean.

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

- **Next action:** Blocked on DSN-009 integration. Sequence before DSN-011/DSN-012 (provides their APIs).
- **Unresolved issues:** None recorded.
