# DSN-018: Styled, guided frontend journey

- **Scope:** core (frontend presentation + guided flow)
- **Priority:** P1
- **Owner:** Integrator (subagent-driven implementers under integrator)
- **Branch/worktree:** `task/DSN-018-frontend-styled-journey` (repo root, serial execution)
- **Owned paths:** `apps/web/src/**` (shell, screens, new `ui/`, `journey.ts`), `apps/web/{tailwind,postcss}.config.js`, `apps/web/package.json`; serialized modify: root `package.json`, `package-lock.json`; `project/decisions/0008-frontend-styling-stack.md`; `docs/superpowers/{specs,plans}/2026-10-07-frontend-styled-journey*.md`
- **Dependencies:** DSN-014 (local e2e harness, decision 0007)
- **PRD references:** Part I; `docs/design/wireframes/README.md` (founder-approved UI direction); Core MVP plan Task 12
- **Decision references:** 0001, 0007, 0008
- **Started:** 2026-10-07
- **Last updated:** 2026-10-07
- **Status:** `in-progress` — executing the approved implementation plan `docs/superpowers/plans/2026-10-07-frontend-styled-journey.md` via subagent-driven development.

## Outcome

A presentable, guided, responsive local demo: Tailwind + Radix design system, a pure state-gated wizard that prevents `ILLEGAL_TRANSITION` by gating the Verify action on `phase`, and all ten screen/panel components restyled with a shared UI layer — preserving every API contract, prop interface, and safety string. Accessibility verification is explicitly deferred to DSN-019.

## Boundaries

- Included: styling stack (decision 0008), design tokens, `apps/web/src/ui/` primitives, pure `apps/web/src/journey.ts` gating, App shell integration (on-mount case fetch, StepRail, phase-gated Verify, Dialog wrap, Callout errors), restyle of all screens, keep the existing web suite green + new unit tests.
- Excluded: PRD accessibility acceptance (**DSN-019**); cloud deploy / production web config / live Gemini (DSN-014 sub-gate 4); automated Playwright e2e (DSN-014 sub-gate 1); any API route / state-machine / contract change.

## Acceptance checks

- [ ] Web suite green (109 existing + new `journey`/`ui`/`App` tests); all three workspaces typecheck clean; API emulator suite 355/355 unchanged.
- [ ] No interaction yields `ILLEGAL_TRANSITION` (incl. attempting Verify from a quiet `Observe` case → guidance, no API call); case loads on reload/deep-link.
- [ ] Every mandated safety string preserved; `RecoveryScreen` keeps Demo Bank/1930 heading parity; Demo Bank/transfer/acknowledgements stay Simulated; proposed ≠ paid; ally view minimum-packet only.
- [ ] `git diff --check` clean; hygiene grep clean; personal no-reply commit identity; manual styled walkthrough recorded.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

(To be filled during execution — commands, results, changed paths, commit IDs.)

## Blocker or deferral

None at claim time. a11y acceptance intentionally out of scope (owned by DSN-019); production CSS build remains part of the DSN-014-blocked deploy path.

## Handoff

Executing the plan task-by-task. Integrator reviews the whole branch, runs the post-integration gate, `--no-ff` merges to local main, moves this record to `done`. Pushing to origin is authorized; deploy/cloud is not.
