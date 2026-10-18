<p align="center"><img src="apps/web/public/brand/second-voice-logo.png" alt="Second Voice: when panic calls, reason answers." width="220"></p>

# Second Voice

**When panic calls, reason answers.** Second Voice is the calm second voice on a suspicious call. It helps a person under pressure slow down, check what the caller claims, bring in a trusted ally, and, if money has already moved, turn everything into a ready-to-file recovery case.

Built for the **AI Builder Cup 2026**, theme **BFSI: Intelligent Risk, Fraud & Financial Experiences**.

**Live app:** https://second-voice-b2c94.web.app (open it in two browser profiles to play the user and their ally)

## The problem

Scam callers isolate their victim: "Your account is compromised, move your money to this safe account now, and don't tell anyone." Existing tools flag a number or show a warning, but the hard part comes after: a frightened person has to work out whether the claim is true, find a real number to check it, involve someone they trust without retelling everything, and act fast if they've already paid.

## What Second Voice does

1. **Screens the call before pickup.** Checks the caller against the user's private list of confirmed fraud numbers and warns before they answer.
2. **Listens and understands.** Transcribes the call and uses Gemini to extract who the caller claims to be, what they want, and the pressure tactics they use (urgency, secrecy, threats), each linked to the line it came from.
3. **Checks the claims.** Gemini with Google Search grounding looks up the claimed organisation's official contact number and judges whether the requested procedure is something a real bank would ever ask for.
4. **Changes the decision, not just the warning.** Before a risky transfer, the user gets a calm pause with clear next steps: call the official number, or ask their ally.
5. **Brings in a trusted ally.** One tap shares exactly the evidence the user picks with a pre-paired ally, who sees the case and responds.
6. **Recovers if they already paid.** "I already paid" turns the same case into a recovery packet: a timeline, evidence, and a pre-filled report for the 1930 helpline / cybercrime.gov.in that the user files themselves. Once the user confirms fraud, the number goes on their private screening list, so they're warned before picking up if it calls again.

The in-app **About** screen lists which integrations are illustrative in this prototype (bank connection and account freeze, caller-ID lookup, and the report channel). All data is sample data.

## Architecture

```
Browser (React SPA)
   │  Firebase Auth (anonymous sign-in)
   ▼
Firebase Hosting ── /api/v1/** ──► Cloud Run: Node 22 + Fastify API (asia-south1, scales to zero)
                                      ├─► Firestore (cases, events, evidence, ally grants)
                                      ├─► Vertex AI Gemini via Google Gen AI SDK
                                      │     (extraction, transcription, Search-grounded verification,
                                      │      recovery script)
                                      └─◄ Cloud Scheduler (OIDC) ─ hourly retention sweep
Secret Manager ─► fraud-list HMAC key
```

- The browser never talks to Firestore or Gemini directly; Firestore rules deny all client access.
- Three separate auth paths: Firebase ID tokens for `/api/v1/**`, a scheduler-only OIDC identity for `/internal/retention/sweep`, and nothing else.
- No API keys in the deployed code: Gemini is called through Vertex AI using the Cloud Run service account, and the one secret lives in Secret Manager.
- Case data expires on a retention schedule. Fraud numbers are stored only as HMAC hashes.

**Google technologies:** Gemini on Vertex AI (Google Gen AI SDK, with Google Search grounding), Cloud Run, Firebase Hosting, Firebase Authentication, Cloud Firestore, Cloud Scheduler, Secret Manager, Cloud Build, Artifact Registry.

## Repository layout

| Path | Contents |
| --- | --- |
| `apps/web` | React + Vite + Tailwind SPA |
| `apps/api` | Fastify API: case store, policy and transitions, Gemini adapters, ally sharing, recovery, export |
| `packages/contracts` | Shared TypeScript types between web and API |
| `apps/android` | Optional Android companion (WebView shell + consented SMS signal) |
| `docs/design/wireframes` | Wireframes for every screen |

## Run it locally

Needs Node 22+ and JDK 21 (for the Firebase emulators). No cloud account needed.

```bash
npm ci
npm run dev:api   # Auth + Firestore emulators, API on :8787 with a deterministic fake Gemini
npm run dev:web   # SPA on http://localhost:5173
```

Use a live model locally with `npm run dev:api:live` (set `GEMINI_API_KEY`, or `GOOGLE_CLOUD_PROJECT` with Application Default Credentials). Tests: `npm test`. Full local, live-model, and Google Cloud deploy steps are in [`docs/demo-runbook.md`](docs/demo-runbook.md).

## How we built this

The project ran as a spec-driven build with AI coding agents working under a written contract:

- [`Decision_Safety_Network_PRD_Draft.md`](Decision_Safety_Network_PRD_Draft.md): the product requirements ("Decision Safety Network" was the working name) and [`docs/founder-demo-vision.md`](docs/founder-demo-vision.md), the product story it came from.
- [`project/decisions/`](project/decisions/): architecture and product decision records.
- [`project/tasks/`](project/tasks/): every task with its acceptance checks and verification evidence.
- [`AGENTS.md`](AGENTS.md), [`project/WORKFLOW.md`](project/WORKFLOW.md), [`docs/superpowers/`](docs/superpowers/): the agent operating contract, task workflow, and implementation plans.

## License

[MIT](LICENSE)
