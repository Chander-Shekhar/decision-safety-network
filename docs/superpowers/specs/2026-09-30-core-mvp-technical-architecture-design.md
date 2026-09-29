# Core MVP Technical Architecture — Design

**Status:** Proposed for founder review

**Date:** 2026-09-30

**Task:** DSN-001

**Product authority:** [Locked PRD](../../../Decision_Safety_Network_PRD_Draft.md), Part I. This document selects an implementation architecture; it does not change product scope or claim that a prototype exists.

## Intent and constraints

The founder approved a Google Cloud-centric, all-TypeScript stack for the AI Builder Cup. The purpose is to make the PRD's one continuous Safety Case demonstrable end to end: an unfolding controlled transcript, a consequential simulated transfer, a proportionate intervention, independent verification or ally review, and same-case recovery. The strongest intervention must arise from joined conversation and payment context, not a scam score. The demo uses only synthetic data, and every institutional or payment action remains visibly simulated.

The build must meet C1–C12 and the Cup-ready gates without adding always-on acquisition, a real bank integration, or stretch features. Two developers need a system that can be deployed, understood, tested, and rehearsed before the 18 October submission deadline. The locked PRD remains authoritative if this design is ambiguous.

## Approaches considered

1. **Selected: one TypeScript modular API with a React client.** Shared event and request schemas reduce handoff errors; one Cloud Run service keeps deployment and observability simple. The cost is that the backend uses Node rather than the founder's strongest language, Java.
2. **React plus Java/Spring Boot API.** Familiar backend ergonomics for the founder and supported on Cloud Run, but two language toolchains and duplicated contracts slow a two-person Cup build. This remains a viable post-Cup replacement behind the same API.
3. **React plus TypeScript API plus Python AI worker.** Python has a rich AI ecosystem, but a second service adds network hops, deployment, failure modes, and cross-language schemas without a core capability that requires it.

No microservice split is justified until measured load or team ownership requires one. Modules have explicit interfaces so a later split remains possible.

## Selected stack and deployment boundary

| Concern | Choice | Boundary |
| --- | --- | --- |
| User and ally surfaces | React, Vite, strict TypeScript, responsive web app on Firebase Hosting | Browser renders the case and sends user actions; it never calls Gemini or Firestore directly. |
| API and orchestration | One Node.js 22 TypeScript service on Cloud Run | Authenticates every case request; coordinates inference, policy, simulation, recovery, and exports. |
| Shared contracts | Small TypeScript package of versioned request, event, and case schemas | Runtime validation at API and model boundaries; no client authority over phase or policy output. |
| Identity | Firebase Authentication for distinct synthetic user and ally accounts | Cloud Run verifies Firebase ID tokens and performs its own role/case authorization. |
| Durable prototype state | Cloud Firestore in `asia-south1` | Case projection plus non-PII audit events; separate ephemeral segments and explicitly selected evidence. |
| Generative inference | Gemini through Google Cloud using `@google/genai` and a Cloud Run service identity | Structured extraction and grounded drafting only; the model cannot mutate case state or select safety-critical actions. |
| Model starting candidate | `gemini-3.5-flash-lite` at the supported `global` endpoint | Keep model ID/configuration versioned and switch to Flash only if the evaluation corpus shows a material quality gap. The global endpoint does not justify an India-only processing claim. |

Firebase Hosting rewrites `/api/**` to the Cloud Run service, giving the web app one origin. Cloud Run and Firestore use `asia-south1`; model availability is separate. Use a dedicated least-privilege Cloud Run service account and Application Default Credentials, never a committed key. Hosting's Cloud Run rewrite can expose the service publicly, so every case endpoint verifies the Firebase token even when called through the direct Cloud Run URL. A public health endpoint contains no case data. [Hosting/Cloud Run](https://firebase.google.com/docs/hosting/cloud-run), [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Cloud Run service identity](https://docs.cloud.google.com/run/docs/securing/service-identity), [model availability](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite).

No Cloud Storage, Cloud Messaging, speech-to-text, or separate worker is required for the Core MVP. Selected text excerpts and generated export files are small enough to serve from the API without adding a storage service. The first actual deployment must be a clean-session smoke test, not a static landing page.

## Module responsibilities and interfaces

| Module | Owns | Must not own |
| --- | --- | --- |
| Case API | Authenticated commands, idempotency, case reads, owner/ally authorization | Generated policy decisions |
| Session intake | Ordered controlled transcript segments, explicit processing consent, degraded status | Hidden microphone or cellular capture |
| Gemini adapter | Bounded context, schema-constrained candidate facts, source segment IDs, uncertainty, and a source-linked conversation-to-payment relation when an intent arrives | Official contact URLs, phase transitions, bank responses |
| Fact validator | Schema check, known-source check, unknown preservation, correction precedence | Inference of unsupported facts |
| Policy engine | Versioned causal matrix and allowed state transitions; at most three grounded user reasons | Free-form model-generated commands |
| Payment simulator | Validate amount and beneficiary, derive new-payee status from a server-owned synthetic beneficiary list, and own all simulated transfer state changes | Real funds, bank authority, or trust in a browser-supplied `newPayee` flag |
| Verification adapter | Versioned fictional Demo Bank registry, simulated result and provenance | Caller-provided contact information |
| Ally service | `Ask My Ally` request, minimal packet, revocable grant, in-app contact request, pause recommendation, checked-source record, and access audit | Transfer control or caller certification |
| Recovery/evidence service | Same-case first-hour actions, timeline, simulated acknowledgement state, recovery-scam warning, reviewable brief, NCRP field-aligned preview, export | Real reporting or fabricated acceptance |

The browser sends transcript segments and proposed payment fields to the Case API. The API validates identity and consent; the server-owned payment simulator validates fields and derives new-payee status before recording a draft event. As beneficiary and amount are entered, Gemini evaluates whether this proposed action matches the caller's source-supported request. That relation cites both transcript segment IDs and the draft-payment event ID; a model assertion without valid references cannot trigger the enhanced intervention. On submit intent, the deterministic policy requires the relation to match the current unchanged payment draft, then evaluates observable manipulation cues, threshold, new-payee status, unverified claim, and consent before selecting an allowed state/action. A conversation-only case or payment-only case cannot enter the enhanced Pause state. The second authenticated ally browser polls its minimum-field API view; no direct database listener is needed for the Cup. User commands such as Pause, Verify, Ask My Ally, Continue, and “I already paid” are distinct API commands with idempotency keys. Each command records an inspectable state change, not merely a dismissed card.

## Case data and consistency

Each `SafetyCase` has a stable case ID and owner UID; a versioned plan/policy snapshot; separate processing, retention, ally-sharing, and export consent; phase and version; source-grounded or user-entered facts; simulated transfer and verification status; ally grant; and recovery progress. Facts carry their origin (`transcript`, `user`, or `simulated partner`), source IDs where available, model version where relevant, uncertainty, and supersession state. A missing field remains `unknown`.

Firestore stores:

- `cases/{caseId}`: current deletable case projection and optimistic version.
- `cases/{caseId}/events/{eventId}`: append-only event envelope with type, actor, time, causation ID, policy/model version, and references; no raw transcript text or unnecessary PII.
- `cases/{caseId}/segments/{segmentId}`: raw controlled transcript text, speaker, order, and expiry while the session is active.
- `cases/{caseId}/evidence/{evidenceId}`: only excerpts the user affirmatively promotes, with source/provenance metadata.
- `cases/{caseId}/allyGrants/{allyUid}`: selected disclosure, expiry, and revocation status.

Gemini is called outside Firestore transactions. A response is accepted only when its schema and cited segment IDs validate and its input case version is still current; stale responses are discarded or recomputed. Firestore transactions atomically append a command event, advance the case version, and update the projection. Duplicate event IDs return the previously recorded result. Corrections append a superseding event, invalidate affected model facts, and cause deterministic re-evaluation; the policy may roll back from Pause to Check or ordinary confirmation only through PRD-allowed transitions. An already-paid command converts the same case to Recover and reuses confirmed fields without requiring re-entry.

The `cases` projection is the fast read model, not a second authority over history. Event envelopes support traceability while the case exists; actor UID and references may themselves be identifying. Case deletion therefore explicitly deletes or anonymizes every event, segment, evidence, and ally-grant child document as well as the parent projection—deleting only the parent would leave subcollections behind. A separate non-identifying tombstone records only that a deletion completed and when, without UID, caller, payee, transcript, or a linkable case ID. No raw request body or transcript is written to application logs.

## Safety, access, and consent

Firestore client Security Rules deny all browser reads and writes. This deliberately isolates the user and ally from direct database access; the Cloud Run service is the only data path. Server Firestore libraries bypass client Security Rules, so the API must verify every token, check case ownership or an active ally grant on each request, and construct the ally packet from an explicit allowlist. The ally gets claim, proposed action, amount, verification gap, and user-selected evidence only; full transcript, unrelated evidence, and other cases are never returned. Revocation takes effect on the next request, including a direct API call. [Firestore server-library behavior](https://firebase.google.com/docs/firestore/security/rules-conditions).

Processing consent gates transcript submission and model calls. Revoking it stops inference and raw intake but leaves manual Pause, Verify, and Recover controls available. The retention preference has three clear choices: **delete case content at close**, **keep only user-confirmed recovery fields for up to 24 hours**, or **keep user-selected evidence excerpts and confirmed fields for up to seven days**. The middle choice is the default: no raw source survives the session, later same-case recovery can reuse only confirmed facts visibly labeled **source not retained**, and an immediate case-delete control remains available. The plan screen states this operational 24-hour retention plainly; it never describes the default as zero storage. The first choice sacrifices later no-reentry recovery and warns before closing. The last choice requires affirmative evidence-retention consent; it never retains the whole transcript by default. Raw segments are explicitly deleted at session close unless promoted. Firestore TTL is a backup cleanup mechanism, not the immediate deletion mechanism, because TTL deletion is asynchronous. Export and ally sharing require their own active consents. [Firestore TTL behavior](https://firebase.google.com/docs/firestore/ttl).

Treat caller/transcript text as hostile input. It can only be model input data; it cannot change system instructions, supply an official registry route, grant ally access, or mark a verification result authoritative. The versioned Demo Bank registry is bundled with the service and contains only fictional details. Real 1930/NCRP information is a source-dated route or field map, never a simulated official response. All transfer, bank, and acknowledgement surfaces carry a persistent **Simulated** label.

## Responsiveness and failure behavior

Incremental segments trigger live Gemini extraction while the conversation unfolds. Draft-payment fields trigger the live cross-context relation before submit intent, reducing the work left at the decisive moment. If the form changes after that inference, the relation is invalidated and recomputed. Submit intent is **non-settling**: it creates a pending simulated transfer, never a completed one. The enhanced Pause state appears only after the relation and its references validate against the submitted draft. If a decisive segment, changed draft, and submit intent race, the transfer stays pending, the UI offers manual Pause/Verify, and the case shows `Check` while inference finishes; it does not invent a positive finding. On model timeout or outage, the transfer remains pending until the user explicitly pauses/cancels, verifies, or continues after acknowledging that the safety check could not be completed. In the joined-risk path, Continue likewise requires explicit consequence acknowledgment. In the payment-only path, the ordinary simulator confirmation applies. No simulated transfer completes automatically. The model adapter has a timeout, one bounded retry for transient failures, and a circuit/degraded indicator. Deterministic manual actions, official-route display, and same-case recovery remain usable during failure.

The controlled target is p95 ≤3 seconds from decisive input to visible intervention, measured end to end in the browser; no claim is made before measurement. During scheduled demo windows, a warm Cloud Run instance may be used if cold-start measurements justify its cost. Cap maximum instances and set a project billing alert. Record model calls, tokens, errors, and estimated cost per completed case, without logging content. [Google Cloud budget behavior](https://docs.cloud.google.com/billing/docs/how-to/budgets).

## Evidence and demo output

The review surface distinguishes source excerpts, user corrections, model summaries, and simulated partner results. `Ask My Ally` creates a case-scoped request; the ally can send an in-app contact request, recommend a pause, and record the independent source checked. None of those actions changes transfer authority or certifies the caller. Recovery puts Demo Bank/provider and 1930 actions first and in parallel, records simulated acknowledgements without claiming external acceptance, and warns about follow-on recovery scams. The generated handoff is a downloadable ZIP containing a user-reviewable HTML brief, machine-readable JSON provenance manifest, and NCRP field-aligned preview; unsupported fields remain blank. The preview says **not submitted or accepted**. The export contains only information permitted by the current export/retention consents. Browser print/save-to-PDF is available without making PDF generation a backend dependency.

The demo includes a scripted attack and a legitimate high-pressure control, both processed afresh by Gemini. A clean account/session can complete setup, intervention, verification, ally review, recovery, and export without database edits or hidden operator actions.

## Verification strategy and scope boundary

Unit tests pin the causal matrix, allowed transitions, corrections, overrides, source validation, and model-failure fallback. API integration tests use Firebase/Firestore emulators to test case ownership, direct ally-denial attempts, revocation, idempotency, and deletion. Browser end-to-end tests cover the user/ally journey and persistent simulation labels. The PRD's 15-script corpus, five runs per script, 30 warm and 10 cold latency trials, ten paired concurrent cases, and accessibility smoke tests remain release gates; measurements are reported, not presumed.

This design does not authorize product code yet. The next artifact is a task-by-task implementation plan after written founder review. Only after that plan is reviewed will DSN-001 capture accepted implementation decisions and release dependent implementation tasks. Stretch capabilities remain outside the Core MVP sequence.

## Founder review focus

Please confirm the three concrete choices that extend the approved high-level stack: (1) the server-only Firestore/API boundary with no direct browser database access; (2) the three retention options, especially the disclosed 24-hour confirmed-facts default; and (3) a non-settling simulated submit intent that waits for an explicit user decision even when Gemini is pending or unavailable. These choices protect the locked PRD's authorization, no-reentry recovery, and user-agency promises; changing any of them will change the implementation plan.
