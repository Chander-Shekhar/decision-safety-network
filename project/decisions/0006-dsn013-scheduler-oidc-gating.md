# 0006: Retention sweep is gated by hand-rolled OIDC verification against an injectable key source

- **Status:** Proposed
- **Date:** 2026-10-04
- **Owners:** DSN-013 implementer (worker subagent) - pending integrator review at merge
- **Related task:** DSN-013
- **PRD references:** C12 retention/deletion; privacy/security
- **Supersedes:** None
- **Superseded by:** None

## Context

`sweepExpiredCases` physically deletes case content once a case has logically
expired; Firestore's own TTL policy is a backup only, so this task needed a
route a Cloud Scheduler job can call promptly. That route (`POST
/internal/retention/sweep`) must be reachable **only** by a dedicated
scheduler service identity, never by any Firebase end-user ID token - a
compromised or merely curious user token must never be able to trigger a
mass-delete sweep. `apps/api/src/auth.ts`'s existing `requireUser` verifies
Firebase *user* ID tokens specifically (`auth.verifyIdToken`); it has no
notion of a Google-signed service-account OIDC token's `aud`/`email` claims,
and wiring real production JWKS fetching (Google's live
`https://www.googleapis.com/oauth2/v3/certs`-equivalent for OIDC) is a
network dependency this task's test suite should not require to pass
deterministically or offline.

## Decision

Implement OIDC verification directly in `apps/api/src/retention-routes.ts`:
parse the bearer token's three dot-separated segments, require `alg: RS256`
with a `kid`, check `aud` against a configured audience, check `email`/
`email_verified` against a configured scheduler service-account email, check
`exp` against the current time, then verify the RS256 signature via
`node:crypto`'s `createVerify('RSA-SHA256')` against a PEM public key
resolved through an injectable `OidcKeySource.getPublicKey(kid)`. Production
wiring (fetching Google's real, rotating JWKS and caching by `kid`) is
deferred to DSN-014 (the integrator task that mounts this route and wires
the actual Cloud Scheduler job); this task's own tests inject a fake key
source backed by a locally generated RSA keypair, so verification logic is
exercised deterministically and offline. A Firebase user ID token is
rejected by construction, without ever needing Firebase-specific detection:
its `aud` is the Firebase project id and its `email` is the end user's own,
so the audience/email checks fail before signature verification is even
attempted.

## Consequences

- Positive: the sweep route's authorization logic is fully testable offline,
  with no live network call in the test suite; a Firebase user token is
  rejected for a structural reason (wrong `aud`/`email`), not a brittle
  token-shape heuristic.
- Cost: this is a hand-rolled, partial OIDC verifier (no JWKS endpoint
  discovery, no key rotation/caching, no `iss` allowlist beyond what a
  caller configures) - it is not a general-purpose OIDC library and must not
  be reused outside this one scheduler-identity use case without review.
- Follow-up (explicit carry-forward to DSN-014/the integrator): wire a real
  `OidcKeySource` that fetches and caches Google's live JWKS by `kid`, and
  configure the real `audience`/`serviceAccountEmail` for the deployed
  Cloud Scheduler job. Until that wiring lands, `createRetentionRoutes` is
  not mounted into `app.ts` and the route does not exist in the deployed
  app.

## Alternatives considered

### Reuse `requireUser`/Firebase Admin SDK token verification
Rejected: `verifyIdToken` is specific to Firebase-issued user tokens and has
no concept of a Google service-account OIDC token's claims; there is no
clean way to make it accept "a specific scheduler identity, nothing else."

### Fetch Google's live JWKS directly in this task
Rejected for this task's scope: a live network dependency inside the test
suite would make tests flaky/offline-incompatible and reach outside owned
paths' intended isolation. The injectable `OidcKeySource` seam makes the
real-JWKS wiring a drop-in replacement for the integrator, without touching
the verification logic itself.

### Shared-secret header instead of OIDC
Rejected: a static shared secret is weaker (no expiry, no built-in rotation,
easy to leak into logs) than Google's own per-invocation signed identity
tokens, which Cloud Scheduler already supports natively for exactly this
use case.

## Verification

- `apps/api/test/retention.test.ts`'s scheduler-OIDC test block: a valid
  self-signed token (matching configured audience/email) is accepted and
  performs the sweep; a request with no `Authorization` header, a real
  Firebase user ID token, a wrong-audience token, a wrong-email token, and
  an expired token are each independently rejected with 401.
- Full API regression (`firebase emulators:exec --only auth,firestore 'npm
  run test:api'`) passed 278/278 with this route included but unmounted in
  `app.ts`.
