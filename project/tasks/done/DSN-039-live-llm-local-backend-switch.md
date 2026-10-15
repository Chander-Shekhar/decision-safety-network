# DSN-039: Live LLM backend switch for local end-to-end testing

- **Scope:** core
- **Priority:** P0
- **Owner:** Founder-directed, implemented in session
- **Branch/worktree:** `worktree-dsn-live-llm-local` @ `.claude/worktrees/dsn-live-llm-local`
- **Owned paths:** `apps/api/src/gemini.ts`, `apps/api/src/dev-server.ts`, `apps/api/src/server.ts`, `package.json` (scripts only), `docs/demo-runbook.md`, `project/decisions/0019-*.md`
- **Dependencies:** DSN-006 (done), DSN-007/decision 0003 (Gemini client), DSN-014 (local harness, decision 0007)
- **PRD references:** C3 living source-linked case; Cup-ready deployed demo
- **Decision references:** 0019 (new), 0001, 0003, 0007
- **Started / finished:** 2026-10-15
- **Status:** `done` — code integrated on the task branch and verified; a real live call is left for the founder to run with their own key (no key in-session).

## Outcome

Enables running the local end-to-end journey against the **real** Gemini model with the identical adapters used in the cloud, without needing a Google Cloud project. `gemini.ts` now selects its backend at runtime (`createGenAiClient()`): Gemini Developer API key (`GEMINI_API_KEY`) or Vertex AI (ADC + `GOOGLE_CLOUD_PROJECT`). `dev-server.ts` gains `DSN_LIVE_GEMINI=1` to swap the fake Gemini + fake transcription for the real adapters while Auth/Firestore stay on the emulators. `buildServer` gained an optional `transcription` port so the dev harness and tests keep the transcription backend consistent with the injected Gemini. Added `npm run dev:api:live`.

## Boundaries

- Included: runtime backend selection, dev live switch, optional transcription injection, dev script, decision 0019, runbook "Run locally with a LIVE LLM" section.
- Excluded: cloud deploy (Q2 — the pre-existing API build defect, emulator-hardcoded web auth, and missing `vite build` remain DSN-014's blocked sub-gates); upgrading `@google/genai`/`gaxios`/`uuid` for the open 0003 advisories (do before cloud).

## Acceptance checks

- [x] `npm run typecheck` clean across contracts/api/web.
- [x] Full API suite green under emulators — the new optional `transcription` param is backward-compatible: 22 files, 428/428.
- [x] Fake Gemini remains the default (`DSN_LIVE_GEMINI` unset); the API-key path needs no GCP project; `DSN_LIVE_GEMINI=1` with no backend fails fast.
- [ ] Real live call walked through the journey — **deferred to founder** (no key in-session). Resume: `GEMINI_API_KEY=... GEMINI_MODEL=... npm run dev:api:live` + `npm run dev:web`.

## Verification evidence

- **Commands and results (worktree, JDK 21 at `/opt/homebrew/opt/openjdk@21`):**
  - `npm run typecheck` → exit 0, all three workspaces.
  - `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test'` → `22 passed (22)`, `428 passed (428)`, script exit 0.
- **Changed paths:** `apps/api/src/gemini.ts`, `apps/api/src/dev-server.ts`, `apps/api/src/server.ts`, `package.json`, `docs/demo-runbook.md`, `project/decisions/0019-gemini-api-key-backend-for-local-and-demo.md`.
- **Limitations / skipped checks:** Emulator requires JDK 21+ (machine default is 17; a Homebrew `openjdk@21` was used via `JAVA_HOME`). No real model call made in-session (no key present); `gcloud` is not installed on the machine, so the Vertex path is untested here — the API-key path is the recommended one for the founder's setup. The pre-existing `npm run build` TS6059 defect (DSN-014 blocker 5) is unchanged and still blocks the Docker image.

## Handoff

- **Next action (founder):** set `GEMINI_API_KEY` (+ `GEMINI_MODEL`) and run `npm run dev:api:live` + `npm run dev:web` to confirm the live journey. For cloud deploy, clear DSN-014's blocked sub-gates (build defect, web auth env-branch, `vite build`) and store the key in Secret Manager.
