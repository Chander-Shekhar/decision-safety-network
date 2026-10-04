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

- **Commits (branch task/DSN-014-integrate-and-deploy-journey):** 7c6a5f8 (fake Gemini + red server test), a023a76 (server.ts), d7c887d (case start/read routes + api-client), 8dc0043 (SPA shell), b540aa5 (e2e source, Dockerfile, smoke, runbook, firebase.json hosting), 16fd7e3 (runbook wording).
- **Integration commit:** Not integrated
- **Commands and results:**
  - RED: `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test -- server.test.ts'` with server.ts absent: file failed to import (no tests ran), exit 1.
  - GREEN: same command after server.ts: 1 file, 16 tests passed.
  - Full API: same emulator wrapper, `npm --workspace apps/api run test`: 15 files, 355 tests passed (339 existing + 16 new).
  - `npm --workspace apps/api run typecheck`: pass. `npx tsc --noEmit -p apps/web/tsconfig.json`: exit 0 (App/main/api-client typecheck).
  - `npm --workspace apps/web run test`: 109 tests passed, BUT vitest also collects `e2e/journey.spec.ts` and reports that file as failed (`@playwright/test` not installed). Needs `exclude: ['e2e/**']` in `apps/web/vitest.config.ts` (not an owned path; no dependency needed).
  - `npm --workspace apps/api run build`: FAILED (tsc -p tsconfig.build.json; rootDir `src` vs. imports of `packages/contracts/src/*.ts` outside it). Not confirmed pre-existing on main; same import pattern already exists in other route files. It also emitted stray untracked `packages/contracts/src/*.js`, which remain untracked and uncommitted and need manual deletion.
  - `git diff --check`: clean. Hygiene grep of owned files: clean.
- **Review-fix pass:** removed duplicate case installer (and unused `requireUser` import) from `server.ts`; one assertion changed in `server.test.ts`: case-create status 201 -> 200 to match the existing installer. All three tests in `journey.spec.ts` are now `test.skip` with a header saying SKIPPED pending shell wiring. `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test'`: 15 files, 355 tests passed; API typecheck clean.
- **Post-integration verification:** Not run
- **Changed paths:** apps/api/src/server.ts, apps/api/test/{fake-gemini,server.test}.ts, apps/web/src/{App,main,api-client}.ts(x), apps/web/index.html, apps/web/e2e/journey.spec.ts, Dockerfile, scripts/smoke.sh, docs/demo-runbook.md, firebase.json (hosting block only).
- **Limitations or skipped checks:** e2e NOT run; SPA not built or served; no real Firebase browser auth; Dockerfile not built; smoke.sh not run; nothing deployed. Review fix: the earlier local case installer in `server.ts` duplicated `caseRoutes` from `case-store.ts`; it was removed and the existing installer is mounted (POST /api/v1/cases returns 200 and uses the plan's real version; PLAN_REQUIRED without a plan). journey.spec.ts references a "Play legitimate scenario" control and an `unzipper` import that are not implemented or pinned. Non-Decision-step UI (segment list, evidence selection, ally-share controls) is a thin shell.

## Blocker or deferral

Blocked sub-gates (owner: founder decision on dependencies / cloud):
1. e2e run: needs `@playwright/test`, browser binaries, `playwright.config.ts`, and a ZIP reader dependency.
2. SPA serve/build: needs Vite build/dev/preview scripts in `apps/web/package.json` and `vite.config.ts`.
3. Browser auth: needs the `firebase` client SDK in `apps/web` to replace the FIREBASE_CLIENT_NOT_WIRED stub in `main.tsx`.
4. Step 5 deploy and live-Gemini smoke: blocked on founder cloud/billing authorization.
Task lands in `blocked`, not `done`.

## Handoff

- **Next action:** Integrator reviews; founder decides on the dependency and cloud gates above; add the vitest e2e exclude; fix or confirm the API build failure.
- **Unresolved issues:** Cloud deploy authorization pending.
