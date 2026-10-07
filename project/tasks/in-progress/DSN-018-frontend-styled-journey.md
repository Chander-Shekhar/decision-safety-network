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
- **Status:** `in-progress` — implementation complete and whole-branch final review passed (ready to merge); integrator merge to local main pending.

## Outcome

A presentable, guided, responsive local demo: Tailwind + Radix design system, a pure state-gated wizard that prevents `ILLEGAL_TRANSITION` by gating the Verify action on `phase`, and all ten screen/panel components restyled with a shared UI layer — preserving every API contract, prop interface, and safety string. Accessibility verification is explicitly deferred to DSN-019.

## Boundaries

- Included: styling stack (decision 0008), design tokens, `apps/web/src/ui/` primitives, pure `apps/web/src/journey.ts` gating, App shell integration (on-mount case fetch, StepRail, phase-gated Verify, Dialog wrap, Callout errors), restyle of all screens, keep the existing web suite green + new unit tests.
- Excluded: PRD accessibility acceptance (**DSN-019**); cloud deploy / production web config / live Gemini (DSN-014 sub-gate 4); automated Playwright e2e (DSN-014 sub-gate 1); any API route / state-machine / contract change.

## Acceptance checks

- [x] Web suite green (109 existing + new `journey`/`ui`/`App`/`VerifyPanel` tests → 13 files / 130 tests); all three workspaces typecheck clean. API emulator suite **not re-run** — see evidence (branch has an empty diff over `apps/api`/`contracts/src`, so the 355/355 result is unaffected by construction; this shell has only JDK 17 and no firebase CLI).
- [x] No interaction yields `ILLEGAL_TRANSITION` — triple-covered: the Verify affordance is **disabled** from `Observe` (test-pinned), the client handler early-returns before `POST /verify`, and the server state machine (`apps/api/src/transitions.ts`) has no `Observe → Verify` edge. Verified by `journey.test.ts` + `VerifyPanel.test.tsx` + whole-branch review. Case-load-on-reload path unchanged.
- [x] Every mandated safety string preserved (final review confirmed verbatim + visible); `RecoveryScreen` keeps Demo Bank/1930 heading parity (both `h2`, equal-weight); Demo Bank/transfer/acknowledgements stay Simulated; proposed ≠ paid; ally view minimum-packet only, no fund-control/caller-certification.
- [x] `git diff --check` clean (whole branch); hygiene grep clean (`apps/web` + decision 0008, NO HITS); personal no-reply commit identity (author + committer) on every branch commit. **Manual visual walkthrough NOT performed** — see limitation below.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

Commands run (2026-10-07, repo root, branch `task/DSN-018-frontend-styled-journey`):

- `npm run typecheck` → clean across `@dsn/contracts`, `@dsn/api`, `@dsn/web`.
- `npm --workspace apps/web run test` → **13 files / 130 tests passed** (added 2 `VerifyPanel` disabled-state tests to the prior 128).
- `git diff --check f8e5333 HEAD` → clean (no whitespace errors on the branch).
- `git grep -nE "sfdc|salesforce|chander|/Users/|repo.local|bazel_jdk|apikey|password|secret" -- apps/web project/decisions/0008-frontend-styling-stack.md` → NO HITS.
- `git log f8e5333..HEAD` author/committer → `Chander Shekhar <44772437+Chander-Shekhar@users.noreply.github.com>` only.

Whole-branch final review (opus, range `f8e5333..9c46ffb`): **ready to merge — zero Critical, zero Important.** Verified in code: `canVerify` matches `transitions.ts`; no API route/state-machine/contract/`api-client` change; browser never calls Firestore/Gemini directly; all safety copy and the five provenance states (distinct by label + `?`/`✓`/`✎` glyph, not color-alone) preserved; recovery routes equal-weight `h2`; lockfile resolves only to `registry.npmjs.org`. Three Minors adjudicated: (1) Verify affordance should be *disabled* not enabled-then-guarded → **fixed** @ `1656caa` (optional `disabled` prop + handler early-return retained; removes the double-guidance path); (2) double `Card` nesting → cosmetic, carried to founder visual pass; (3) weak Verify test coverage → **closed** by the two new disabled-state tests in the same fix.

Changed paths (whole branch, `f8e5333..HEAD`): `apps/web/src/**` (new `ui/`, `journey.ts`, restyled screens, `App.tsx`), `apps/web/{tailwind,postcss}.config.js`, `apps/web/package.json` + root `package-lock.json`, `project/decisions/0008-frontend-styling-stack.md`, `project/tasks/**` (DSN-018, DSN-019), `docs/superpowers/{specs,plans}/2026-10-07-frontend-styled-journey*.md`. Runbook (`docs/demo-runbook.md`) left unchanged — the run steps (dev servers, port 5173, journey order) did not change; only presentation did.

Branch commits: `77deafc` (task records) → `2135138`+`cac68c0` (styling stack + spacing fix) → `aacb683` (journey.ts) → `fdbfaa7` (ui primitives) → `85fda56` (App integration) → `207d7e1` (Plan) → `6a874b5` (Session/Decision cluster) → `ea51087` (Verify/Ally) → `9c46ffb` (Recovery/Evidence) → `1656caa` (Verify-disabled final-review fix).

## Blocker or deferral

Not blocked. Limitations recorded for founder follow-up (none block the local merge):

- **Manual visual walkthrough not performed by the agent.** The dev stack (`npm run dev:api`) needs the firebase emulator + JDK 21, unavailable in this shell (only JDK 17; no firebase CLI). The *behavioral* targets of the walkthrough (no `ILLEGAL_TRANSITION`, Verify-from-quiet-case blocked, persistent Simulated + pre-OTP banner) are covered by the automated suite and final review; the *visual* styling + ~440px responsive check needs human eyes. **Recommend the founder run `npm run dev:api` + `npm run dev:web` and eyeball the journey (incl. the double-`Card` nesting observation) before the Cup demo.**
- **API emulator suite not re-run** (JDK 17 only / no firebase CLI); unaffected by construction — the branch has an empty diff over `apps/api`/`contracts/src`.
- a11y acceptance intentionally out of scope (owned by **DSN-019**); production CSS build remains part of the DSN-014-blocked deploy path.

## Handoff

Executing the plan task-by-task. Integrator reviews the whole branch, runs the post-integration gate, `--no-ff` merges to local main, moves this record to `done`. Pushing to origin is authorized; deploy/cloud is not.
