# DSN-026: Open-web claim verification evidence

- **Scope:** core
- **Priority:** P1
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** None until claimed (expected: `apps/api/src/verification*`, `packages/contracts/src/**`, `apps/web/src/VerifyPanel.tsx`/`DecisionMap.tsx`)
- **Dependencies:** DSN-022
- **PRD references:** Part I — Decision 19; C7 (web lookups as labeled untrusted evidence); Responsibility boundary; Trust gate (actionable route still from curated records)
- **Decision references:** 0010
- **Started:** Not started
- **Last updated:** 2026-10-11

## Outcome

The verification adapter performs grounded open-web lookups of the caller's claimed identity and the institution's official contact numbers, surfaced in Verify/Decision Map as labeled, untrusted supporting evidence that corroborates or contradicts the claim (e.g. "this number does not match HDFC's registered pattern") — never the actionable official route and never self-certifying.

## Boundaries

- Included: grounded web lookup (via the Google AI grounding path or a curated adapter), labeled-evidence contract field, Verify/Decision Map presentation, prompt-injection resistance tests.
- Excluded: using web results as the official verification route; auto-certifying a caller; replacing the versioned Demo Bank registry.

## Acceptance checks

- [ ] A claimed identity with a mismatching number shows a labeled contradiction; a plausible match shows labeled corroboration.
- [ ] Web/caller-ID evidence is server-labeled untrusted and cannot become the official route or certify the caller (direct API test).
- [ ] Injection content embedded in web results cannot alter policy or supply an official contact (test in the eval injection set).
- [ ] API + web suites green; typecheck clean.

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

- **Next action:** Prepare and claim after DSN-022.
- **Unresolved issues:** Grounding mechanism (live Gemini grounding vs. curated adapter) to be chosen and recorded in a decision.
