# 0019: Select the Gemini backend (Developer API key or Vertex AI) at runtime

- **Status:** Accepted
- **Date:** 2026-10-15
- **Owners:** Founder-directed; implemented in session (DSN-039)
- **Related task:** DSN-039 (live LLM in local testing); builds on 0001, 0003, 0007
- **PRD references:** C3 living source-linked case; Cup-ready deployed demo
- **Supersedes:** None (refines 0003's Vertex-only client provisioning into a two-backend selector)
- **Superseded by:** None

## Context

Decision 0003 provisioned `@google/genai` and `gemini.ts` hard-wired it to
Vertex AI mode (`vertexai: true`, `GOOGLE_CLOUD_PROJECT`, `location: 'global'`),
which requires a Google Cloud project, billing, the Vertex AI API enabled, and
ADC. The founder has a consumer Google account with a Gemini subscription and
can obtain a **Gemini Developer API key** (Google AI Studio), but has **no GCP
project** today. The P0 need is to run the local end-to-end journey against the
**real** model with the same code path that runs in the cloud, without first
standing up a GCP project.

`@google/genai` supports both backends through the same client surface: Vertex
AI mode vs. the Gemini Developer API (constructed with `{ apiKey }`). The
adapters, prompts, schemas, `temperature: 0`, Zod re-validation, and the
owner-confirmation safety boundary are identical for both.

## Decision

`gemini.ts` selects the backend at runtime via `createGenAiClient()`:

- `GEMINI_API_KEY` set → Gemini Developer API with that key (no GCP project,
  ADC, or billing wiring). The key is read only from the environment, never
  logged or persisted; in the cloud it must come from Secret Manager, never the
  image.
- otherwise → Vertex AI mode (unchanged from 0003), the enterprise/IAM path.

The local dev harness (`dev-server.ts`) gains `DSN_LIVE_GEMINI=1`, which swaps
the fake Gemini + fake transcription for the real adapters while Auth/Firestore
stay on the emulators — so the only live dependency is the model. `buildServer`
gained an optional `transcription` port so the dev harness and tests keep the
transcription backend consistent with the injected Gemini. `GEMINI_MODEL` must
be set to a model id the chosen backend exposes (the default
`gemini-3.5-flash-lite` targets Vertex naming).

## Consequences

- Positive: live-LLM local E2E needs only an API key — zero GCP setup — and the
  identical adapter runs in the cloud. Deployment can keep the API key (as a
  Secret Manager secret) and skip Vertex/ADC/`aiplatform.user` wiring entirely,
  or still choose Vertex by leaving `GEMINI_API_KEY` unset.
- Cost/limitation: a live run makes real, billable model calls against the
  provided key/project. The API-key and Vertex paths may expose different model
  ids; `GEMINI_MODEL` must match the active backend.
- Security follow-up: 0003's two moderate transitive advisories
  (`uuid`/`gaxios`) are still open and must be revisited before a cloud deploy.
  The API key is a secret — it must never be committed and never baked into the
  image.

## Alternatives considered

### Keep Vertex-only (status quo)
Rejected: requires a GCP project the founder does not have, blocking the P0
live-LLM local test behind cloud setup that is otherwise deferred.

### Add a GCP project now and use Vertex locally via ADC
Rejected for now: heavier (project + billing + API enablement + ADC/service
account) than the P0 needs. Still fully supported — leaving `GEMINI_API_KEY`
unset selects it unchanged.

## Verification

- `npm run typecheck` → clean across all three workspaces.
- Full API suite under emulators (JDK 21): `npx firebase emulators:exec
  --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test'`
  → 22 files, 428/428 passed (the new optional `transcription` param is
  backward-compatible).
- Live call not exercised in-session (no key present yet). Resume check: with a
  key set, `npm run dev:api:live` + `npm run dev:web` and walk the journey;
  confirm a real model response and no cloud resource beyond the model call.
