# 0001: Google Cloud TypeScript architecture for the Core MVP

- **Status:** Accepted
- **Date:** 2026-10-02
- **Owners:** Founder and DSN-001 integrator
- **Related task:** DSN-001
- **PRD references:** Part I, Core MVP C1–C12, causal acceptance matrix, canonical states, Cup-ready definition
- **Supersedes:** None
- **Superseded by:** None

## Context

The Cup build has two developers, a Google Cloud hosting constraint, a locked end-to-end Safety Case scope, and a short deadline. The founder is comfortable with TypeScript/React and approved an all-TypeScript Google Cloud direction. The product must join live controlled conversation context to a consequential simulated transfer, then support verification, ally review, and same-case recovery. It must preserve consent, source provenance, explicit human agency, and honest simulation boundaries. The [approved architecture spec](../../docs/superpowers/specs/2026-09-30-core-mvp-technical-architecture-design.md) carries the detailed design and is the implementation reference for this record.

## Decision

Use a React/Vite strict-TypeScript web app on Firebase Hosting, a single Node.js 22 TypeScript modular API on Cloud Run, Firebase Authentication, and Cloud Firestore in `asia-south1`. All browser case data flows through authenticated API endpoints; the browser never reads or writes Firestore or calls Gemini directly. Firestore client rules deny browser access, and the API independently checks owner and case-scoped ally authorization on every request. Use versioned shared runtime schemas, server-owned case commands and events, a deterministic versioned policy, and Gemini through Google Cloud for structured source-linked inference only. The model cannot select commands, set institutional routes, or mutate the case directly. The starting model candidate is `gemini-3.5-flash-lite` at the supported `global` endpoint; pin and evaluate its actual configuration rather than promising India-only model processing.

Offer three retention choices: delete case content at close; retain only user-confirmed facts for up to 24 hours by default; or retain user-selected evidence excerpts and confirmed facts for up to seven days with affirmative consent. Raw transcript segments expire at session close unless explicitly promoted. An immediate delete removes the parent and all identifying descendants; an unlinkable tombstone may record completion. A retained fact without its source is visibly labeled **source not retained**.

The simulated payment submit intent is non-settling. It records a pending proposed transfer and waits for an explicit human decision even when Gemini is still running or unavailable; it never auto-completes. Enhanced Pause requires a valid relation between cited conversation segments and the current payment draft. The demo describes the moment as **before OTP/authorization**, not as a real transfer held or reversed. Every payment, bank, 1930, and reporting response that the prototype produces remains persistently labeled **Simulated**. Same-case recovery begins when the user reports they already paid; it is not evidence of a real recovered transfer.

OS/OEM or payment-surface integration is a post-Cup direction because a standalone web app cannot reliably observe imminent real payments without a signal. Call listening alone is not the differentiator; decision orchestration and recovery continuity are the hypothesis being tested. These future integrations are not Core MVP dependencies.

## Consequences

- One language and one API deployment simplify shared contracts, reviews, and controlled demonstration. A server-only boundary centralizes authorization, retention, and audit enforcement.
- The team must implement and test explicit case/ally authorization, subcollection deletion, stale-model rejection, idempotent commands, and model-degraded behavior; security rules alone do not protect server SDK access.
- The controlled simulator proves product behavior, not production call access, bank authority, fraud prevention, or fund recovery. The UI and submission must preserve those limits.
- The default 24-hour confirmed-facts window supports no-reentry recovery but is not zero storage; the plan screen must disclose it plainly.
- A single Cloud Run service is sufficient for the Cup but leaves scale and production partnership decisions open to measurement and later records.

## Alternatives considered

### React with Java/Spring Boot API

Familiar for the founder, but two language toolchains and duplicated contracts add integration overhead to the two-person Cup build. It remains a possible post-Cup replacement behind stable API contracts.

### React with TypeScript API and separate Python AI worker

Adds a deployment, network hop, and failure boundary without a Core MVP capability requiring Python. Revisit only if measured needs justify it.

### Direct browser access to Firestore

Would complicate case-scoped authorization, revocation, and retention enforcement. Rejected for this prototype.

### Auto-completing or claiming to hold a real transfer

Would violate the user-agency and simulation boundary. Rejected even when inference is unavailable or slow.

## Verification

The implementation plan must test all four causal-matrix rows; every allowed and prohibited state transition; stale and unavailable Gemini results; a changed draft at submit; direct API owner/ally authorization and immediate revocation; three retention modes and descendant deletion; persistent simulation labels; and same-case recovery without re-entry. Cup readiness additionally requires the locked PRD's corpus, latency, concurrency, accessibility, and clean-session deployment gates. Changes to this accepted decision require a new superseding record, not an edit to this one.
