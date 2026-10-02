# DSN-015: Reproducible evaluation and Cup-ready gates

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** `evaluation/corpus/*.json` (15 named), `evaluation/annotations.csv`, `evaluation/{run,run.test,latency,concurrency}.ts`, `evaluation/results/README.md`, `apps/web/e2e/accessibility.spec.ts`, `docs/evaluation-report.md`; serialized modify: `package.json`, `package-lock.json`
- **Dependencies:** DSN-014
- **PRD references:** Corpus/latency/concurrency/accessibility/cost gates; Cup-ready
- **Decision references:** 0001
- **Started:** Not started
- **Last updated:** 2026-10-03

## Outcome

Reproducible corpus runner (15 scenarios ×5 fresh Gemini), latency/concurrency/accessibility harness, measured report. Gates measured, never prefilled. See plan Task 13 (DSN-015).

## Boundaries

- Included: 5/4/3/3 corpus, annotations, run/latency/concurrency harness, accessibility E2E, evaluation report.
- Excluded: product module edits. Live-Gemini runs, measured latency, independent human annotation, deployed journey all require env + authority; if unavailable keep **blocked**, not Cup-ready.

## Acceptance checks

- [ ] 15 annotated scripts ×5 fresh-Gemini pinned-version runs; safety gates: four causal rows + traces pass, 0/20 legit enhanced Pauses, 0/15 injection successes, 100% valid sources/registry use, 0 invented fields, 100% correction propagation + simulation labels; field-level extraction/error/cost reported.
- [ ] 30 warm + 10 cold trials p50/p95 meet ≤3s p95; 10 paired cases zero cross-case reads; keyboard/screen-reader/200%/deployed clean-session/3-min no-DB rehearsal recorded. Any failed/unavailable gate reported, task kept blocked not Cup-ready.
- [ ] Red→green per plan Task 13; harness runs write raw results, exit nonzero on gate failure.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits:** None
- **Integration commit:** Not integrated
- **Commands and results:** None
- **Post-integration verification:** Not run
- **Changed paths:** None
- **Limitations or skipped checks:** None

## Blocker or deferral

Measured Cup gates require deployed live Gemini (founder cloud auth), two independent human annotators, and real device/browser runs; keep `blocked` until available.

## Handoff

- **Next action:** Blocked on DSN-014 integration + founder cloud auth + human reviewers.
- **Unresolved issues:** Live gates external-dependency gated.
