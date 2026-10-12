# DSN-032: Playwright end-to-end harness + reconcile the target journey spec

- **Scope:** core (verification harness — founder-directed Req C: "a Playwright pass is authorized against the fake Gemini model")
- **Priority:** P1
- **Owner:** Orchestrator (integrator)
- **Branch/worktree:** `task/DSN-032-playwright-e2e-harness` (started 2026-10-12)
- **Owned paths (planned):** `apps/web/playwright.config.ts` (new), `apps/web/e2e/**` (de-skip + reconcile `journey.spec.ts`), `apps/web/package.json` (devDep + `test:e2e` script), root `package.json` (existing `test:e2e` delegator — touch only if needed), `package-lock.json` (lockfile — serialized integrator), `.gitignore` (ignore `playwright-report/` + `test-results/`). Serialized: lockfile + root config owned by the integrator. Does NOT touch product `src/` behavior; if a spec cannot pass without a shell change, that is recorded as a limitation, not silently patched here.
- **Dependencies:** DSN-014 local sub-gate (dev stack: `npm run dev:api` emulator + fake-Gemini dev-server on :8787, `npm run dev:web` Vite :5173 proxy — both already wired). DSN-030/DSN-031 shell state (transcript input, verification) is live on `main`.
- **PRD references:** Part I — Cup-ready definition (one case, explicit simulated decision, ally reach, recovery, evidence export); C6 (≤3 reasons); honesty/"Simulated" labeling; responsibility boundary.
- **Decision references:** may add a decision record for the e2e harness + webServer orchestration + fake-Gemini determinism if the wiring is consequential.

## Outcome

The deferred Playwright sub-gate is un-deferred (founder Req C). `apps/web/e2e/journey.spec.ts` currently ships as source-only, every test `test.skip`, with a stale header (it predates the now-wired `firebase` client in `main.tsx` and the `vite.config.ts` dev server). This task installs `@playwright/test` + the Chromium binary, adds a `playwright.config.ts` whose `webServer` boots the **local, no-cloud, fake-Gemini** stack (Firebase emulator + API dev-server on :8787 + Vite on :5173), reconciles the three journey specs against the **real** rendered shell (correct control names / testids), and runs them green headless at both a desktop and a 440px mobile viewport. No live Gemini, no cloud, no deploy.

## Boundaries

- Included: `@playwright/test` devDependency + Chromium install; `playwright.config.ts` (baseURL, webServer orchestration, desktop + 440px projects, headless, `reuseExistingServer` locally); `test:e2e` script in `apps/web`; de-skipping and reconciling `journey.spec.ts` to the real shell; asserting the persistent "Simulated" labeling in the journey; gitignoring Playwright report/output.
- Excluded: changing product `src/` behavior to make a spec pass (record as a limitation instead); live Gemini / cloud / deploy; CI wiring (local run only this task); the DSN-022 interactive polish pass (this only captures the 440px/desktop walkthrough evidence, it does not restyle).

## Acceptance checks

- [ ] `@playwright/test` is an `apps/web` devDependency; Chromium binary installed; `npx playwright --version` works.
- [ ] `playwright.config.ts` boots the local stack via `webServer` with **fake Gemini only** (no `GOOGLE_CLOUD_PROJECT`/ADC, no `DSN_WEB_VERIFICATION=grounded`); baseURL :5173; desktop + 440px viewport projects; headless.
- [ ] `journey.spec.ts` is de-skipped and reconciled to the real shell: the attack journey, the legitimate high-pressure control, and the auth-guard spec pass headless. Any assertion the shell cannot satisfy is reconciled to the real intended flow or recorded as a limitation — product `src/` is not changed under this task.
- [ ] The journey asserts the persistent "Simulated" labeling is visible (PRD honesty) and that an ally never sees the raw scam claim as instruction.
- [ ] `npm run test:e2e` green locally; existing web unit suite (201) + `npm run typecheck` still green; no secrets, browser binaries, `playwright-report/`, or `test-results/` committed.

## Verification evidence

_(filled at completion)_
