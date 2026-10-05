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
- **Last updated:** 2026-10-05
- **Status:** `blocked` — local dependency-free composition integrated to local main and fully green; four external sub-gates (e2e run, SPA serve/build, browser auth, cloud deploy) plus the pre-existing API build defect remain blocked (see Blocker).
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

> **Acceptance status (integrator):** boxes remain unchecked because each check depends on a blocked external sub-gate (two-browser Playwright e2e, SPA build/serve, browser auth, `npm run build`, deploy). The portions achievable locally and dependency-free ARE integrated and verified green: the composition root mounts all 12 installers, `server.test.ts` proves 401 on every mounted route + case create/read + the three auth paths, no client Firestore/Gemini import, persistent Simulated + pre-OTP copy present in the shell, `typecheck`/`git diff --check` clean. Full acceptance resumes when the blocked sub-gates are authorized.

## Verification evidence

- **Commits (branch task/DSN-014-integrate-and-deploy-journey):** 7c6a5f8 (fake Gemini + red server test), a023a76 (server.ts), d7c887d (case start/read routes + api-client), 8dc0043 (SPA shell), b540aa5 (e2e source, Dockerfile, smoke, runbook, firebase.json hosting), 16fd7e3 (runbook wording), d24e431 (branch verification evidence), 5e5e5a4 (BLOCKING fix 1: mount existing case-store `caseRoutes`, drop local duplicate + unused `requireUser`), 1c72fe6 (BLOCKING fix 2: `journey.spec.ts` all `test.skip`), 1a6e10b (branch review-fix evidence).
- **Integration commit:** `5968b66` (`--no-ff` merge into local main; no conflicts), followed by integrator glue `3d16e87` (serialized `apps/web/vitest.config.ts` `exclude: ['e2e/**']`). Local only; NOT pushed.
- **Commands and results:**
  - RED: `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test -- server.test.ts'` with server.ts absent: file failed to import (no tests ran), exit 1.
  - GREEN: same command after server.ts: 1 file, 16 tests passed.
  - Full API: same emulator wrapper, `npm --workspace apps/api run test`: 15 files, 355 tests passed (339 existing + 16 new).
  - `npm --workspace apps/api run typecheck`: pass. `npx tsc --noEmit -p apps/web/tsconfig.json`: exit 0 (App/main/api-client typecheck).
  - `npm --workspace apps/web run test`: 109 tests passed, BUT (pre-exclude) vitest also collected `e2e/journey.spec.ts` and reported that file as failed (`@playwright/test` not installed). Integrator applied `exclude: ['e2e/**']` to `apps/web/vitest.config.ts` (serialized) at `3d16e87`.
  - `npm --workspace apps/api run build`: FAILED (tsc -p tsconfig.build.json; rootDir `src` vs. imports of `packages/contracts/src/*.ts` outside it). **CONFIRMED pre-existing on clean main** by the integrator (independent of DSN-014): the same TS6059 reproduces on `main` before this merge because every `apps/api/src/*.ts` route file imports contracts by the relative `../../../packages/contracts/src/*.js` path, outside `tsconfig.build.json`'s `rootDir: src` with `paths: {}`. It also emits stray `packages/contracts/src/*.js` (not gitignored). The integrator cleaned the stray emit from both main and the worktree; `git status` clean. Needs its own task + a serialized tsconfig/project-references decision — DSN-014 does not worsen it and `typecheck` (path-mapped `tsconfig.json`, no `rootDir`) stays green.
  - `git diff --check`: clean. Hygiene grep of owned files: clean.
- **Review-fix pass:** removed duplicate case installer (and unused `requireUser` import) from `server.ts`; one assertion changed in `server.test.ts`: case-create status 201 -> 200 to match the existing installer. All three tests in `journey.spec.ts` are now `test.skip` with a header saying SKIPPED pending shell wiring. `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test'`: 15 files, 355 tests passed; API typecheck clean.
- **Independent review (dsn014-review, read-only):** Verdict **merge-after-listed-BLOCKING-fixes**. Reviewer independently ran the full API emulator suite (355/355, 15 files), API+web typecheck, `git diff main...HEAD --check` (clean), hygiene grep (clean); confirmed no package.json/lockfile/tsconfig/vitest touched on the branch. **3 BLOCKING (all resolved before merge):** (1) `server.ts` local `caseRoutes` duplicated `case-store.ts:154`'s exported installer (local defaulted planVersion to 1, returned 201; existing reads real plan version, returns 200, throws PLAN_REQUIRED) — fixed by importing the existing installer (`5e5e5a4`); (2) `journey.spec.ts` referenced controls no shell `.tsx` renders so it could not pass as written — made explicitly `test.skip` (`1c72fe6`); (3) vitest globbed the Playwright spec → web suite exited 1 — fixed by the integrator vitest exclude (`3d16e87`). **NON-BLOCKING carry-forwards (4-12):** (4) POST /cases not idempotent (matches existing installer; UUID-key convention is for commands); (5) GET /cases/:id returns the raw envelope but ownership is enforced (403 non-owner, 401 unauth, no cross-user leak) — now the existing installer's reviewed behavior; (6) Dockerfile `CMD` depends on the broken build + a possible `npm ci --workspace` lockfile mismatch — artifact depends on the pre-existing defect, does not worsen it; (7) fake Gemini double confined to `apps/api/test/fake-gemini.ts` with `isTestDouble: true`, guard is a duck-typed flag check (weak but adequate); (8) mounted-route tests only prove 401, not per-route behavior, and a scheduler identity calling `/api/v1/**` is untested; (9) the IDEMPOTENCY_CONFLICT→409 test exercises a `configure` probe route, not real composition, and red-first was not re-verified (only final green); (10) deploy artifacts carry no real project ID/credential/email/path (synthetic `demo-dsn`/`example.invalid`); reviewer did not read `docs/demo-runbook.md` — **integrator verified** it: explicit "pending founder cloud authorization; nothing deployed or executed", Demo Bank/transfer/acknowledgement labelled Simulated, 1930 + cybercrime.gov.in described as real routes never filed on the user's behalf, deploy steps marked BLOCKED, placeholders only, ZIP "a preview, never a submitted report"; (11) client idempotency smell: `withKey` puts a fresh key in the body while `command` generates a separate header key, so a retry can send mismatched header/body keys; (12) pre-existing build break confirmed structurally. Full review (verdict + findings 1-12) received across the initial message and a resend; verdict unchanged throughout.
- **Post-integration verification (on local main @ `3d16e87`):** `npm run typecheck` -> clean (contracts, api, web); `npm --workspace apps/web run test` -> 10 files, 109/109 (e2e excluded, suite green); full API emulator suite `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test'` -> 15 files, 355/355; `git diff --check` -> clean; hygiene `git grep -iE` over all 14 integrated DSN-014 paths (sfdc/salesforce/chander//Users//repo.local/bazel_jdk/apikey/password/secret) -> no hits; committer+author identity on every DSN-014 commit = `44772437+Chander-Shekhar@users.noreply.github.com` (personal no-reply); working tree clean, no stray build artifacts.
- **Changed paths:** apps/api/src/server.ts, apps/api/test/{fake-gemini,server.test}.ts, apps/web/src/{App,main,api-client}.ts(x), apps/web/index.html, apps/web/e2e/journey.spec.ts, Dockerfile, scripts/smoke.sh, docs/demo-runbook.md, firebase.json (hosting block only).
- **Limitations or skipped checks:** e2e NOT run; SPA not built or served; no real Firebase browser auth; Dockerfile not built; smoke.sh not run; nothing deployed. Review fix: the earlier local case installer in `server.ts` duplicated `caseRoutes` from `case-store.ts`; it was removed and the existing installer is mounted (POST /api/v1/cases returns 200 and uses the plan's real version; PLAN_REQUIRED without a plan). journey.spec.ts references a "Play legitimate scenario" control and an `unzipper` import that are not implemented or pinned. Non-Decision-step UI (segment list, evidence selection, ally-share controls) is a thin shell.

## Blocker or deferral

Status: `blocked`. The local dependency-free composition is integrated to local main @ `3d16e87` and fully green; the following remain blocked.

Blocked sub-gates (owner: founder decision on dependencies / cloud):
1. e2e run: needs `@playwright/test`, browser binaries, `playwright.config.ts`, and a ZIP reader dependency (`journey.spec.ts` is authored + `test.skip` pending this). Evidence: `@playwright/test` not installed; spec drives a served SPA. Next action: founder authorizes the dev-dependency decision; then un-skip + run under the emulator.
2. SPA serve/build: needs Vite build/dev/preview scripts in `apps/web/package.json` and `vite.config.ts`. Evidence: no build script exists; `main.tsx` is a react-only mount. Next action: founder authorizes the Vite build decision.
3. Browser auth: needs the `firebase` client SDK in `apps/web` to replace the `FIREBASE_CLIENT_NOT_WIRED` stub in `main.tsx`. Evidence: no `firebase` dep in `apps/web`. Next action: founder authorizes the client-SDK decision.
4. Deploy (Step 5) + live-Gemini smoke: blocked on founder cloud/billing authorization. Evidence: `docs/demo-runbook.md` deploy section marked BLOCKED; nothing deployed/executed. Next action: founder grants cloud/billing authorization.
5. Pre-existing `npm run build` defect: `tsconfig.build.json` `rootDir: src` + relative `packages/contracts/src/*.js` imports → TS6059 + stray `.js` emit. Confirmed on clean main (NOT introduced by DSN-014). Evidence recorded above. Next action: open a dedicated serialized task + a `project/decisions/` entry for a tsconfig/project-references fix; owner = integrator/founder scheduling.

Non-blocking carry-forwards (do not block this task; fold into the resume or a follow-up):
- Client idempotency smell (review F11): `api-client.ts` `withKey` sets a body key while `command` generates a separate header key — a retry can send mismatched header/body keys. Low risk (server keys per command); fix when the client is next edited.
- Doc drift: `docs/demo-runbook.md` route table still lists `POST cases` as `(201, ...)` but the mounted installer now returns 200. Correct when the runbook's deploy section is revisited at sub-gate 4.
- Review F8/F9: mounted-route tests only assert 401, not per-route behavior; scheduler-identity-on-`/api/v1/**` untested; the IDEMPOTENCY→409 test uses a `configure` probe route, not real composition. Strengthen when the e2e sub-gate lands.

Task lands in `blocked`, not `done`.

## Handoff

- **Next action:** Local composition is integrated, reviewed, and green on local main @ `3d16e87`; vitest e2e exclude applied; API build defect confirmed pre-existing. Task parked `blocked`. Founder decisions required to resume: (a) the three dev-dependency decisions (Playwright+browsers, Vite build, firebase client SDK), (b) cloud/billing authorization for deploy + live-Gemini smoke, (c) scheduling the dedicated build-defect task + decision. On authorization, un-skip `journey.spec.ts`, add the build/serve tooling, and run the two-browser emulator e2e + deployed smoke.
- **Unresolved issues:** Four external sub-gates + the pre-existing build defect (all in Blocker). Founder-surface items consolidated for the whole-product handoff; cloud deploy + Cup submission remain unauthorized (strictly local this pass).
