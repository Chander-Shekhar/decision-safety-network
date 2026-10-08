# Demo runbook (DSN-014)

**Status:** authored for the eventual Cloud Run / Firebase Hosting path. **Deploy is pending founder cloud authorization; nothing here has been deployed or executed.** Everything in the product is synthetic. Demo Bank, the transfer, and local acknowledgements are **Simulated**; the 1930 helpline and cybercrime.gov.in are real official routes and are never filed on the user's behalf.

## Architecture (single origin)

Browser -> Firebase Hosting (SPA) -> rewrite `/api/v1/**` -> Cloud Run service (region `asia-south1`, Node 22) -> Firestore + Gemini. The browser never talks to Firestore or Gemini. Three mutually exclusive auth paths: public `GET /healthz` (no case data), `/api/v1/**` (Firebase ID token `Authorization: Bearer <token>`), and `POST /internal/retention/sweep` (Cloud Scheduler OIDC token for the dedicated scheduler service account only). Any other path is 404.

## Configuration (environment, never committed)

`PORT` (default 8080), `GOOGLE_CLOUD_PROJECT`, `GEMINI_MODEL`, `DSN_SCHEDULER_AUDIENCE`, `DSN_SCHEDULER_SA`. Placeholders only: `DSN_GCP_PROJECT`, `DSN_API_SA`, `DSN_SCHEDULER_SA`. `NODE_ENV=production` rejects the test Gemini double.

## Request and error shapes

Commands are JSON. Routes that accept an idempotency key take `idempotencyKey` (RFC 4122 v4) in the body; the client also sends an `Idempotency-Key` header. Errors are `{ "error": "<CODE>" }`.

| Code | Status |
| --- | --- |
| UNAUTHENTICATED | 401 |
| FORBIDDEN | 403 |
| NOT_FOUND | 404 |
| PLAN_REQUIRED, INVALID_IDEMPOTENCY_KEY, INVALID_BODY | 400 |
| VERSION_CONFLICT, IDEMPOTENCY_CONFLICT | 409 |
| EXPIRED | 410 |

Routes (all under `/api/v1`): `PUT plan`; `POST ally-pairing-code`; `POST ally-invitations` `{pairingCode}`; `POST ally-invitations/:id/accept|revoke`; `POST cases` (200, needs saved plan); `GET cases/:id`; `POST cases/:id/segments` `{id,order,speaker,text}`; `POST cases/:id/processing/revoke`; `POST cases/:id/facts/extract` `{expectedVersion}`; `POST cases/:id/facts/:field/correct` `{value,expectedVersion}`; `POST cases/:id/facts/:field/confirm` `{expectedVersion}`; `POST cases/:id/payment/draft` `{beneficiaryId,amountMinor,expectedVersion,idempotencyKey}`; `POST cases/:id/payment/submit` `{draftId,expectedVersion,idempotencyKey}`; `POST cases/:id/payment/recheck`; `POST cases/:id/actions/pause|cancel|verify|continue` `{expectedVersion,idempotencyKey}`; `GET registry/demo-bank`; `POST cases/:id/verify` `{}`; `POST cases/:id/ally-share-preview` `{selectedEvidenceIds}`; `POST|DELETE cases/:id/ally-grant`; `GET ally/cases/:id`; `POST ally/cases/:id/response` `{idempotencyKey,kind}`; `POST cases/:id/recovery/enter`; `GET cases/:id/recovery`; `POST cases/:id/recovery/paid-details`; `POST cases/:id/recovery/acknowledgement`; `GET cases/:id/evidence?ids=`; `POST cases/:id/session/close`; `POST cases/:id/export` (ZIP). Outside `/api/v1`: `GET /healthz`, `POST /internal/retention/sweep`.

## Synthetic accounts and fixtures

Two synthetic Firebase accounts created by the "Create synthetic user" / "Create synthetic ally" buttons (no credentials stored). Attack fixture: caller "Demo Bank fraud team", claim "Account compromised", payee `safe-new`, amount 50,000 (5,000,000 paise). Legitimate control: known payee, no enhanced Pause.

## Three-minute path (narration)

1. (0:00) Plan: "This is a simulated prototype on synthetic data." Save plan, pair ally.
2. (0:30) Session: controlled transcript plays; facts appear with sources; confirm claim, payee, amount.
3. (1:00) Payment: simulated new-payee transfer submitted; joined Pause "before you enter an OTP".
4. (1:30) Verify with the Demo Bank registry; preview the exact ally packet, then explicitly Share; ally recommends pause.
5. (2:00) Cancel the simulated transfer; "I already paid" opens same-case recovery with blank paid fields until the user reports a match.
6. (2:30) Download the evidence ZIP (`brief.html`, `provenance.json`, `ncrp-preview.html`): a preview, never a submitted report.

Scenario two: legitimate high-pressure call, ordinary confirmation, no enhanced Pause.

## Run locally end-to-end (no cloud, no cost)

Fully local: Firebase emulators + the deterministic fake Gemini (no real Gemini/Vertex call, no billable resource). See decision 0007. The emulator needs a JDK, so export `JAVA_HOME` first (shell only — never committed).

1. `export JAVA_HOME=<path-to-a-jdk-21>` and `export PATH="$JAVA_HOME/bin:$PATH"`.
2. Terminal A: `npm run dev:api` — starts the Auth (`:9099`) + Firestore (`:8080`) emulators and the dev API on `:8787` with the fake Gemini.
3. Terminal B: `npm run dev:web` — serves the SPA on `http://localhost:5173` (proxies `/api/v1/**` and `/healthz` to `:8787`).
4. Open `http://localhost:5173` in two windows (owner in one, ally in an incognito/second-profile window — each gets its own anonymous emulator user). Walk the Plan → Session → Decision → Verify → Ally → Recovery → Evidence journey.

Smoke check (with the dev servers up): `curl http://localhost:5173/healthz` → `{"status":"ok"}`; `curl http://localhost:5173/api/v1/cases/x` → `401 {"error":"UNAUTHENTICATED"}`. The automated two-browser Playwright journey (`apps/web/e2e/journey.spec.ts`) stays `test.skip` pending the Playwright dependency decision.

## Native Android companion (DSN-020, optional demo add-on)

A sideloaded **debug** Android app (`apps/android/`) hosts the same local web UI in a full-screen WebView and forwards consented, session-scoped incoming SMS into the Decision view as a message **claim** — never a verified fact or a completed payment. No backend/API/contract change; it points at the local web + API dev servers. Synthetic demo data only; call audio stays **Simulated** (the app never records calls). This is an add-on to the web demo, not a replacement.

**Build and smoke are BLOCKED on DSN-021** (Android SDK, JDK 21 on PATH, React Native CLI) — none were present on the authoring machine, so the APK has not been built, installed, or smoke-tested, and nothing here is reported green. The bring-up runbook (scaffold via `react-native init`, package wiring, manifest, build, smoke) lives in `apps/android/README.md`.

Once DSN-021 prerequisites are met (summary — full steps in `apps/android/README.md`):

1. Start the local web + API dev servers (the "Run locally end-to-end" section above): Terminal A `npm run dev:api` (`:8787`), Terminal B `npm run dev:web` (`:5173`).
2. Expose BOTH ports to the device/emulator — the WebView loads `:5173`, which proxies to the API on `:8787`:
   ```bash
   adb reverse tcp:5173 tcp:5173
   adb reverse tcp:8787 tcp:8787
   ```
3. Launch the companion, tap **I consent - start session**, and grant the RECEIVE_SMS runtime permission. The honesty label ("Simulated call audio…") is persistent.
4. Smoke (emulator): `adb emu sms send VM-DEMOBK "Your account is blocked. Pay Rs 50000 to keep funds safe."` → the SMS appears in the Decision view as a received-message **claim**. After **Withdraw consent / end session**, or with the app backgrounded, the same command produces no signal (listener is session- and foreground-scoped; SMS history is never read).

## Deploy steps (BLOCKED until founder cloud authorization)

Validate `DSN_GCP_PROJECT`, `DSN_API_SA`, `DSN_SCHEDULER_SA`; enable only required services; set budget alert and max instances; build the Dockerfile and deploy to Cloud Run in `asia-south1`; deploy Hosting; create the Cloud Scheduler job calling `POST /internal/retention/sweep` with an OIDC token from `DSN_SCHEDULER_SA`; verify a user token and an unauthenticated call are denied; run `BASE_URL=... ID_TOKEN=... scripts/smoke.sh` and confirm a fresh live Gemini call for the run. Operational logs carry route template, status, and latency only.
