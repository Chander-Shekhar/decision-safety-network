# DSN-024: Pre-pickup caller screening (caller-ID + private fraud list)

- **Scope:** core
- **Priority:** P1
- **Owner:** Orchestrator (subagent-driven implementer under integrator)
- **Branch/worktree:** `task/DSN-024-pre-pickup-caller-screening` (isolated worktree)
- **Owned paths:** NEW `apps/api/src/screening*` + `apps/api/src/fraud-list*` (+ matching `apps/api/test/**`), NEW `packages/contracts/src/screening.ts` (and additive edits to `fraud`/`case` contracts if needed), NEW `apps/web/src/` screening screen + edits to incoming-call/session entry. Serialized/not owned: do not restructure plan/recovery/ally/payment/verification semantics.
- **Dependencies:** DSN-022, DSN-023 (plan `callListening` readable via `getPlan`) — both integrated. Pairs with DSN-025.
- **PRD references:** Part I — C2 (pre-pickup screening), C13 (private confirmed-fraud list); External-signals scope row; Responsibility boundary (untrusted signals); non-goal (no public blacklist)
- **Decision references:** 0010
- **Started:** 2026-10-11
- **Last updated:** 2026-10-11

## Outcome

Before pickup, an incoming call shows a screening verdict: a (simulated, swappable-adapter) third-party caller-ID/reputation signal plus a check against the private confirmed-fraud list, with a calm "unverified caller" / "previously reported" warning. The private list is written only on user fraud-confirmation or authority report (C13).

## Boundaries

- Included: caller-ID adapter interface + simulated impl, private fraud-list store + read/write API, pre-pickup screen UI, calm warning copy, list-population hook from case resolution/report.
- Excluded: public blacklist, criminal attribution, any cross-user exposure beyond "warn the recipient"; real Truecaller credentials (adapter is simulated for the Cup).

## Acceptance checks

- [ ] An incoming call from an unverified/previously-reported number shows the warning before pickup; a clean number shows nothing.
- [ ] Confirming a case as fraud (or reporting it) adds the identifier to the private list; a later matching call warns.
- [ ] Caller-ID/web signals are stored/labeled as untrusted evidence and cannot become the official route or certify a caller (direct API test).
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

- **Next action:** Prepare and claim; coordinate owned paths with DSN-025.
- **Unresolved issues:** None recorded.
