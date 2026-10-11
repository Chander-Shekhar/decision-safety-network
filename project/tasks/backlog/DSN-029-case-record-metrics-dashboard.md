# DSN-029: Case record + metrics/intelligence dashboard

- **Scope:** stretch
- **Priority:** P2
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** None until claimed (expected: new dashboard surface + aggregation API)
- **Dependencies:** DSN-024 (fraud list / case record), core demo stable
- **PRD references:** Part I — Stretch S10; Decision/analytics bounded-impact constraint; Part II Capabilities G & H
- **Decision references:** 0010
- **Started:** Not started
- **Last updated:** 2026-10-11

## Outcome

A persistent record of every handled case feeds a dashboard and analytics: manipulation attempts, amount saved, cases shared with authorities, and area/attack-type threat intelligence, plus proactive-education notifications. Every impact figure is bounded to the recorded synthetic evidence — no population-level or real-world efficacy claim.

## Boundaries

- Included: case-record persistence, aggregation/metrics API, dashboard UI, area/attack-type breakdown, proactive-education notification hook, bounded-impact labeling.
- Excluded: real-world efficacy/loss-prevention claims; public accusation; any work that precedes a stable core demo (stretch gate).

## Acceptance checks

- [ ] The dashboard renders metrics computed from the persisted case records (synthetic corpus).
- [ ] Every displayed impact figure carries a bounded-to-recorded-evidence qualifier.
- [ ] Does not start until the Core Cup-ready gate passes (stretch ordering honored).
- [ ] Suites green; typecheck clean.

## Verification evidence

- **Commits:** None
- **Integration commit:** Not integrated
- **Commands and results:** None
- **Post-integration verification:** Not run
- **Changed paths:** None
- **Limitations or skipped checks:** None

## Blocker or deferral

Deferred until the Core Cup-ready gate passes per PRD stretch ordering; resume condition — core demo stable and a complete three-minute cut exists.

## Handoff

- **Next action:** Hold in backlog until core is Cup-ready.
- **Unresolved issues:** None recorded.
