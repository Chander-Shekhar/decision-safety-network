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

- [x] `@playwright/test` is an `apps/web` devDependency; Chromium binary installed; `npx playwright --version` works. (`@playwright/test@1.64.0` in `apps/web/package.json` devDependencies; Chromium installed to the global cache earlier this session.)
- [x] `playwright.config.ts` boots the local stack via `webServer` with **fake Gemini only** (no `GOOGLE_CLOUD_PROJECT`/ADC, no `DSN_WEB_VERIFICATION=grounded`); baseURL :5173; desktop + 440px viewport projects; headless. (`emulatorEnv.DSN_WEB_VERIFICATION: ''` forces the curated adapter; webServer = emulator-wrapped `dev-server.ts` on :8787 + Vite on :5173.)
- [x] `journey.spec.ts` is de-skipped and reconciled to the real shell: the attack journey, the legitimate control, and the auth-guard spec pass headless. The enhanced-Pause discriminator is `phase === 'Pause'` (the acknowledgment checkbox + "Confirm Continue"), not the always-present "Before you enter an OTP" card title. Product `src/` was not changed.
- [x] The journey asserts the persistent "Simulated" labeling is visible (PRD honesty) and that the caller's words are framed as a CLAIM, never an instruction (Decision Map "Claimed identity"/"Central claim"; the Pause offers the ally route rather than acting). The sealed, simulated official verification reports "Claim not supported". **Limitation:** the owner-side ally-share *preview dialog* could not be driven from the UI — see Limitations below.
- [x] `npm run test:e2e` green locally (6/6: 3 specs × desktop + mobile-440); web unit suite 201/201 and `npm run typecheck` clean across all three workspaces; no secrets, browser binaries, `playwright-report/`, or `test-results/` committed (all gitignored).

## Verification evidence

Commands (from repo root, `JAVA_HOME=/opt/homebrew/opt/openjdk@21`):

- `npm --workspace apps/web run test:e2e` → **8 passed**: `attack journey`, `legitimate control`, `near-neighbor check control`, `api auth guard`, each on the `desktop` (1280×800) and `mobile-440` (440×900) projects. (`MetadataLookupWarning … ETIMEDOUT/ENOTFOUND` from the emulator is benign — no ADC in the sandbox.)
- `npm --workspace apps/web run test` → **Test Files 22 passed; Tests 201 passed**.
- `npm run typecheck` → clean for `@dsn/contracts`, `@dsn/api`, `@dsn/web`.

The attack spec drives the real shell end to end: first-run setup wizard (listening mode + processing + ally-sharing consent) → start controlled session → paste a scam transcript → the fake Gemini extracts "Demo Bank fraud team" / "Account compromised" under claim-labeled fact rows → correct the seeded `observedTactics` fact to turn on `cues` → confirm the claimed-identity fact → draft a ₹50,000 transfer to new payee `safe-new` → submit (PaymentPanel auto-rechecks) → the joined case advances to the `phase === 'Pause'` enhanced Pause: the acknowledgment-gated Continue, ≤3 reasons including the unverified-claim reason, the persistent simulated header note, and the sealed simulated verification returning "Claim not supported". The control (small, no cue, no join → Observe) shows the same OTP card but a plain, non-gated "Continue the transfer" and no reinforced bank-policy reason. The near-neighbor check control (same manipulation cue as the attack, but a small unjoined transfer → Check) also stays non-gated, so the acknowledgment gate is proven to track `phase === 'Pause'` specifically rather than the mere presence of cues. The auth guard confirms unauthenticated case + ally reads return 401 through the Vite proxy.

Independent adversarial review (code-review subagent) returned no false-greens and confirmed scope compliance. Its actionable test-only findings were applied before merge: a `User confirmed` provenance barrier after the confirm step (removes a `VERSION_CONFLICT` draft race), the added near-neighbor Check control, a pinned 3-reason assertion at the Pause, and `trace: 'retain-on-failure'` (retries:0 made `on-first-retry` never capture).

Changed paths: `apps/web/playwright.config.ts` (new), `apps/web/e2e/journey.spec.ts` (rewritten from `test.skip` stubs), `apps/web/package.json` (`@playwright/test` devDep + `test:e2e` script), `.gitignore` (Playwright output), `package-lock.json` (lockfile).

## Limitations

- **Owner-side ally-share preview dialog is a shell gap (not covered by the UI e2e; proposed follow-up).** `App.tsx` posts every transcript segment id as `selectedEvidenceIds` to `cases/:id/ally-share-preview`, but no UI (and no server auto-step) ever promotes a segment into the `evidence` subcollection via `POST cases/:id/evidence/:segmentId/promote`. `previewAllyPacket` requires each selected id to resolve to a promoted evidence doc, so the preview always throws `UNKNOWN_EVIDENCE` ("Request failed (UNKNOWN_EVIDENCE). Nothing was changed."). The e2e therefore does not drive the preview dialog. The ally packet's claim / proposed-action / verification-gap allowlist, and that the raw transcript is never shared, remain covered at the API layer by `apps/api/test/ally.test.ts` (which seeds promoted evidence directly). This is a product-scope discovery → remains **Proposed** pending founder direction; it is not patched under this harness task. Suggested follow-up: a DSN task to add an evidence-selection/promote affordance (Decision transcript or Evidence step) so the owner can choose which excerpts the ally sees before preview/share.
