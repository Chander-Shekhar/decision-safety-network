# DSN-003: Authenticated case/event foundation

- **Scope:** core
- **Priority:** P0
- **Owner:** DSN-003 implementer subagent (serialized under integrator)
- **Branch/worktree:** `task/DSN-003-authenticated-case-event-foundation` @ `.worktrees/dsn-003-authenticated-case-event-foundation`
- **Owned paths:** `package.json`, `package-lock.json`, `tsconfig.base.json`, `firebase.json`, `firestore.rules`, `.firebaserc.example`, `.npmrc`, `apps/api/package.json`, `apps/web/package.json`, `packages/contracts/package.json`, `packages/contracts/src/case.ts`, `apps/api/src/{app,auth,case-store}.ts`, `apps/api/test/{case-store,auth,test-auth}.ts`
- **Dependencies:** None (foundation; Tasks 2–13 depend on it)
- **PRD references:** C12 trust/failure/privacy; locked PRD Part I
- **Decision references:** 0001-google-cloud-typescript-architecture
- **Started:** 2026-10-03

## Outcome

Workspace + authenticated TypeScript API shell with transactional, idempotent case/event store; browser Firestore access denied. See plan Task 1 (DSN-003).

## Boundaries

- Included: workspace/build/test config, deny-all `firestore.rules`, `Phase`/`CaseEnvelope`/`CaseEvent`/`CaseCommand`/`CaseCommandResult`, `ApiDeps`, `RouteInstaller`, `buildApi`, `requireUser`, `createCase`, `readCase`, `commitCaseCommand`, `authHeader` test helper, `POST /api/v1/cases`, `GET /api/v1/cases/:id`.
- Excluded: any feature route/module (plan Tasks 2–13). Pin exact npm versions against the PUBLIC registry; the committed lockfile must contain no workplace/`sfdc.net` URLs.

## Acceptance checks

- [ ] Authenticated owner can create/read one case; missing/invalid token denied; another user cannot read or command it; client Firestore rules deny direct access.
- [ ] Duplicate same-payload command → one event + original minimal receipt; same key/different payload fails `IDEMPOTENCY_CONFLICT`; other user cannot replay a key. Emulator tests + `npm run typecheck` pass.
- [ ] Red→green per plan Task 1 Steps 1–5; `firebase emulators:exec --only auth,firestore 'npm run test:api -- case-store.test.ts auth.test.ts'` passes without skips; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

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

- **Next action:** Promote to `ready`, claim, dispatch implementer.
- **Unresolved issues:** Verify public-registry lockfile hygiene before integration.
