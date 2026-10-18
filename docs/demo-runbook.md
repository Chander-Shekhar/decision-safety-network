# Demo runbook (DSN-014)

**Status:** deployed to Cloud Run + Firebase Hosting (project `second-voice-b2c94`, `asia-south1`) on 2026-10-18 using the commands in "Deploy to Google Cloud" below. Everything in the product is synthetic. Demo Bank, the transfer, and local acknowledgements are **Simulated**; the 1930 helpline and cybercrime.gov.in are real official routes and are never filed on the user's behalf.

## Architecture (single origin)

Browser -> Firebase Hosting (SPA) -> rewrite `/api/v1/**` -> Cloud Run service (region `asia-south1`, Node 22) -> Firestore + Gemini. The browser never talks to Firestore or Gemini. Three mutually exclusive auth paths: public `GET /healthz` (no case data), `/api/v1/**` (Firebase ID token `Authorization: Bearer <token>`), and `POST /internal/retention/sweep` (Cloud Scheduler OIDC token for the dedicated scheduler service account only). Any other path is 404.

## Configuration (environment, never committed)

API (Cloud Run): `PORT` (default 8080), `GOOGLE_CLOUD_PROJECT`, `GEMINI_MODEL` (default `gemini-3.5-flash-lite`), `DSN_SCHEDULER_AUDIENCE`, `DSN_SCHEDULER_SA`, `FRAUD_LIST_HMAC_SECRET` (from Secret Manager; the server refuses to boot without it), optional `DSN_WEB_VERIFICATION=grounded` (web lookup on). `NODE_ENV=production` rejects the test Gemini double. Leave `GEMINI_API_KEY` unset in the cloud: Vertex AI authenticates via the service account, so no API key exists.

Web (build time): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` in the git-ignored `apps/web/.env.production.local` (template: `apps/web/.env.example`). These are public Firebase web identifiers, not secrets, but stay out of Git. When unset, the web app uses the local emulators.

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

## Run locally with a LIVE LLM (real model, emulated auth/db)

Exercises the same `gemini.ts` adapters that run in the cloud; only Auth and Firestore stay on the emulators, so the one live dependency is the model (a real, billable call). See decision 0019. Pick ONE backend:

- **Gemini Developer API key (no GCP project needed):** get a key at `aistudio.google.com` → API keys. Then `export GEMINI_API_KEY=<your-key>` and `export GEMINI_MODEL=gemini-flash-latest` (verified working on the Developer API; the code default `gemini-3.5-flash-lite` targets Vertex naming and does not resolve here). The key is a secret — shell env only, never committed. Validate the key end-to-end first with `npm run smoke:llm` (one real call through the adapter; retries transient free-tier 503s).
- **Vertex AI (needs a GCP project):** `gcloud auth application-default login` and `export GOOGLE_CLOUD_PROJECT=<project>` (leave `GEMINI_API_KEY` unset). The principal needs `roles/aiplatform.user`.

Then: Terminal A `npm run dev:api:live` (same emulators + dev API on `:8787`, but the real Gemini + transcription adapters); Terminal B `npm run dev:web`. The API logs the active backend on boot. `DSN_LIVE_GEMINI=1` with neither backend configured fails fast with a clear error.

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

## Deploy to Google Cloud

Stack: Firebase Hosting (SPA) → Cloud Run `dsn-api` (scale to zero) → Firestore (native, `asia-south1`) + Vertex AI Gemini (`@google/genai`, location `global`). Auth is Firebase anonymous sign-in. Operational logs carry route template, status, and latency only.

### One-time project setup (console)

1. Create a Firebase project; upgrade to Blaze and set a budget alert.
2. Firestore: create the database in native mode, location `asia-south1`.
3. Authentication → Sign-in method: enable **Anonymous**.
4. Project settings → add a **Web app**; copy its config into `apps/web/.env.production.local` (from `apps/web/.env.example`).
5. Install `gcloud`, then `gcloud auth login`, `gcloud config set project <P>`, `gcloud config set run/region asia-south1`, and `npx firebase login`.

### One-time project setup (CLI)

```bash
P=<project-id>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firestore.googleapis.com aiplatform.googleapis.com secretmanager.googleapis.com \
  cloudscheduler.googleapis.com iamcredentials.googleapis.com --project $P

gcloud iam service-accounts create dsn-api --display-name="Second Voice API (Cloud Run)" --project $P
gcloud iam service-accounts create dsn-scheduler --display-name="Second Voice retention scheduler" --project $P
API_SA=dsn-api@$P.iam.gserviceaccount.com
for R in roles/datastore.user roles/aiplatform.user roles/firebaseauth.viewer; do
  gcloud projects add-iam-policy-binding $P --member="serviceAccount:$API_SA" --role=$R --condition=None
done

# Fraud-list HMAC key: generated straight into Secret Manager, never printed or stored locally.
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create fraud-list-hmac --data-file=- --replication-policy=automatic --project $P
gcloud secrets add-iam-policy-binding fraud-list-hmac --member="serviceAccount:$API_SA" \
  --role=roles/secretmanager.secretAccessor --project $P
```

### Deploy the API (Cloud Run)

Docker is not required locally; `--source .` builds the root `Dockerfile` in Cloud Build. The Cloud Run URL is `https://dsn-api-<project-number>.asia-south1.run.app` and is needed as the scheduler audience.

```bash
URL=https://dsn-api-<project-number>.asia-south1.run.app
gcloud run deploy dsn-api --source . --project $P --region asia-south1 \
  --service-account dsn-api@$P.iam.gserviceaccount.com \
  --min-instances 0 --max-instances 2 --memory 512Mi --cpu 1 --concurrency 40 --timeout 120 \
  --allow-unauthenticated \
  --set-secrets FRAUD_LIST_HMAC_SECRET=fraud-list-hmac:latest \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$P,DSN_SCHEDULER_AUDIENCE=$URL,DSN_SCHEDULER_SA=dsn-scheduler@$P.iam.gserviceaccount.com"
```

`--allow-unauthenticated` only lets requests reach the app; every `/api/v1/**` route still requires a Firebase ID token and `/internal/retention/sweep` requires the scheduler's OIDC token. `--min-instances 0` scales to zero when idle; `--max-instances 2` caps cost. Redeploy code with the same command; change only config with `gcloud run services update dsn-api --region asia-south1 --update-env-vars KEY=VALUE`.

**Web lookup** (Gemini with Google Search grounding for bank verification and official-contact lookup; off = curated Demo Bank only):

```bash
gcloud run services update dsn-api --region asia-south1 --project $P --update-env-vars DSN_WEB_VERIFICATION=grounded   # on
gcloud run services update dsn-api --region asia-south1 --project $P --remove-env-vars DSN_WEB_VERIFICATION           # off
```

### Deploy the web app, Firestore rules, and indexes

```bash
(cd apps/web && rm -rf dist && npx vite build --mode production)
npx firebase deploy --only hosting,firestore:rules,firestore:indexes --project $P
```

`firestore.rules` denies all client access (the browser only talks to the API). `firestore.indexes.json` holds the collection-group index that `GET /api/v1/ally/cases` needs; it takes a few minutes to build (`gcloud firestore indexes fields describe allyUid --collection-group=allyGrants --project $P` shows `READY`). The emulator never enforces indexes, so a new `collectionGroup()` or composite query that works locally can fail in the cloud with `FAILED_PRECONDITION` until its index is added here.

### Retention sweep (Cloud Scheduler)

```bash
gcloud run services add-iam-policy-binding dsn-api --region asia-south1 --project $P \
  --member=serviceAccount:dsn-scheduler@$P.iam.gserviceaccount.com --role=roles/run.invoker
gcloud scheduler jobs create http dsn-retention-sweep --location asia-south1 --project $P \
  --schedule "0 * * * *" --time-zone "Asia/Kolkata" --uri "$URL/internal/retention/sweep" --http-method POST \
  --oidc-service-account-email dsn-scheduler@$P.iam.gserviceaccount.com --oidc-token-audience "$URL" --attempt-deadline 60s
gcloud scheduler jobs run dsn-retention-sweep --location asia-south1 --project $P   # force one run; expect 200 in the logs
```

### Verify

```bash
H=https://<project-id>.web.app
curl -s -w ' %{http_code}\n' $H/api/v1/cases/x                         # 401 UNAUTHENTICATED (API reachable via Hosting)
curl -s -o /dev/null -w '%{http_code}\n' -X POST $URL/internal/retention/sweep   # 401 without scheduler token
gcloud run services logs read dsn-api --region asia-south1 --project $P --limit 30
```

Then open the Hosting URL in two browser profiles (owner and ally) and walk the journey. A populated "What we noticed" confirms live Gemini extraction.

Known quirks: `GET /healthz` on the `run.app` URL returns a Google 404 (Cloud Run reserves some paths ending in `z`), and via Hosting it falls through to the SPA, so `scripts/smoke.sh`'s health check is not meaningful in the cloud; use the 401 checks above instead. The Firebase emulators used locally need JDK 21.
