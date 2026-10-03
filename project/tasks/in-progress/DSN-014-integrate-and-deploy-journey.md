# DSN-014: Integrate clean-session product and deployment path

- **Scope:** core
- **Priority:** P0
- **Owner:** Integrator (DSN-014 implementer subagent under integrator)
- **Branch/worktree:** `task/DSN-014-integrate-and-deploy-journey` @ `.worktrees/dsn-014-integrate-and-deploy-journey`
- **Owned paths:** `apps/api/src/server.ts`, `apps/api/test/fake-gemini.ts`, `apps/api/test/server.test.ts` (new boot/compose test), `apps/web/src/{App,main}.tsx`, `apps/web/index.html`, `apps/web/src/api-client.ts`, `apps/web/e2e/journey.spec.ts`, `Dockerfile`, `scripts/smoke.sh`, `docs/demo-runbook.md`; serialized modify: `firebase.json`
- **Dependencies:** DSN-008 (done), DSN-010 (done), DSN-011 (done @ fe7c7f3), DSN-012 (done @ b3dd87a), DSN-013 (done @ f9e3e90)
- **PRD references:** Cup-ready clean deployed demo
- **Decision references:** 0001
- **Started:** 2026-10-04
- **Last updated:** 2026-10-04
- **Scope note (this pass):** Founder authorized the LOCAL integration portion only and directed "keep strictly local" + "defer all pending decisions." This pass delivers the **dependency-free** composition (API composition root `server.ts` wiring all 10 route installers, `fake-gemini.ts` test double, react-only web shell `App/main/index.html` + injected-token `api-client.ts`, `Dockerfile`/`smoke.sh`/`demo-runbook.md` artifacts, `firebase.json` hosting rewrites) and authors `journey.spec.ts` as the red e2e **without running it**. Executing the two-browser Playwright journey + serving the Vite SPA + real Firebase browser auth require NEW serialized dev dependencies (`@playwright/test` + browser binaries, Vite app build/dev scripts + `vite.config.ts`, `firebase` client SDK) — a consequential dependency decision deferred per founder instruction. Deploy (Step 5) blocked on founder cloud/billing authorization. Task lands in `blocked`, not `done` (plan completion contract).

## Outcome

Single-origin `/api/v1/**` web/API wiring, three-auth-path dispatch, local emulator-backed two-browser attack+legitimate E2E, deployment files + runbook. Live-Gemini deploy gate blocked until founder cloud authorization. See plan Task 12 (DSN-014). Entire wireframe gallery.

## Boundaries

- Included: route/screen composition, `fake-gemini.ts` (test-only), api-client (no Firestore import), journey E2E, Dockerfile, smoke.sh, runbook, firebase.json rewrites.
- Excluded: evaluation gates (DSN-015). **No deploy/push/cloud resource without separate founder authorization** — record deploy step as blocked external gate, not passed.

## Acceptance checks

- [ ] Clean checkout: two-browser emulator-backed attack journey + legitimate control pass with no DB edits; attack completes full journey; control has no enhanced Pause; proposed vs actual-paid labeling correct; no unconfirmed field silently filled.
- [ ] No client Firestore/Gemini traffic; three auth paths enforce Firebase-vs-scheduler identity; persistent simulation/pre-OTP copy visible. Live-Gemini deployed smoke recorded only after founder cloud auth; otherwise deployment gate = **blocked**.
- [ ] Local green per plan Task 12 Steps 1–4; `npm ci && typecheck && build && emulator E2E` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits:** None
- **Integration commit:** Not integrated
- **Commands and results:** None
- **Post-integration verification:** Not run
- **Changed paths:** None
- **Limitations or skipped checks:** None

## Blocker or deferral

Deployment (Step 5) requires founder cloud/billing authorization; record as external gate, keep `blocked` not `done`/Cup-ready if local-only.

## Handoff

- **Next action:** Blocked on DSN-008/010/011/012/013 integration.
- **Unresolved issues:** Cloud deploy authorization pending.
