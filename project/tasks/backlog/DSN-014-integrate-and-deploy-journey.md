# DSN-014: Integrate clean-session product and deployment path

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** `apps/api/src/server.ts`, `apps/api/test/fake-gemini.ts`, `apps/web/src/{App,main}.tsx`, `apps/web/index.html`, `apps/web/src/api-client.ts`, `apps/web/e2e/journey.spec.ts`, `Dockerfile`, `scripts/smoke.sh`, `docs/demo-runbook.md`; serialized modify: `firebase.json`
- **Dependencies:** DSN-008, DSN-010, DSN-011, DSN-012, DSN-013
- **PRD references:** Cup-ready clean deployed demo
- **Decision references:** 0001
- **Started:** Not started
- **Last updated:** 2026-10-03

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
