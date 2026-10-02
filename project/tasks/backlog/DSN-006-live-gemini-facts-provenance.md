# DSN-006: Live Gemini facts, provenance, and correction

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** `packages/contracts/src/facts.ts`, `apps/api/src/{gemini,fact-validator,fact-routes}.ts`, `apps/api/test/facts.test.ts`, `apps/web/src/{DecisionMap,DecisionMap.test}.tsx`
- **Dependencies:** DSN-003, DSN-005
- **PRD references:** C3 living source-linked case; C12 prompt-injection resistance
- **Decision references:** 0001
- **Started:** Not started
- **Last updated:** 2026-10-03

## Outcome

Structured source-linked Gemini extraction with validation, correction, confirmation, provenance labels, and bounded timeout/retry/degraded behavior. See plan Task 4 (DSN-006). UI frame 02. Produces `GeminiPort` consumed by DSN-008.

## Boundaries

- Included: `CandidateFact`/`Fact`/`FactsProjection`/`CandidateRelation`, `GeminiPort`, `validateFacts`, `correctFact`, `confirmFact`, DecisionMap.
- Excluded: policy/action selection (DSN-007). Model never selects actions or returns policy. No scam probability/mental-state label.

## Acceptance checks

- [ ] Every accepted model fact schema-valid + cites existing segment; required fields present or `unknown`; corrections/confirmations preserve provenance and supersede model facts.
- [ ] New segment → fresh Gemini call; fabricated citations, hostile instructions, stale case/draft versions, post-revocation in-flight results cannot alter trusted state; timeout/one-retry/degraded behavior correct.
- [ ] Red→green per plan Task 4; `test:api -- facts.test.ts` + `test:web -- DecisionMap.test.tsx` + `typecheck` pass; `git diff --check` clean.

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

- **Next action:** Blocked on DSN-005 integration.
- **Unresolved issues:** Live-Gemini calls use fake `GeminiPort` in tests; real calls gated to DSN-014 cloud auth.
