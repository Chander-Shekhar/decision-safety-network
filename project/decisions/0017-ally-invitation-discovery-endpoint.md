# 0017: Ally-keyed invitation discovery endpoint

- **Status:** Accepted
- **Date:** 2026-10-15
- **Owners:** Orchestrator / DSN-035
- **Related task:** DSN-035
- **PRD references:** Core MVP Safety Ally pairing
- **Supersedes:** None
- **Superseded by:** None

## Context

The owner→ally pairing was only half-wired. The server could issue a pairing
code (`POST /ally-pairing-code`), create an invitation from a redeemed code
(`POST /ally-invitations`), and accept one by id
(`POST /ally-invitations/:id/accept`). But every read of the `allyInvitations`
collection was keyed on `ownerUid`; nothing let an authenticated ally learn
that an invitation had been addressed to *them*, nor its id. Since accept
requires the invitation id, the ally could never accept, and the ally screen
had no way to react to an incoming invitation. In the web client the ally's
"Accept invitation" button only set local state and never called the API.

## Decision

Add one ally-keyed read: `GET /api/v1/ally/invitations`, returning the
authenticated ally's currently-active (unrevoked) invitations
(`listInvitationsForAlly`, scoped strictly to the token's `allyUid`). The
records are the existing detail-free `AllyInvitation` shape — id and the two
UIDs and the accepted/revoked timestamps — and carry no case data. The web
ally session polls this endpoint to discover an invitation, reflect its state
(waiting / invited / connected), and drive the real accept call. No change to
the invitation data model or the owner-side routes.

## Consequences

- Completes the pairing loop end to end; the ally screen now reacts to an
  invitation and accept operates on a real id.
- Adds one authenticated read route under the existing `/ally/` namespace,
  consistent with `GET /ally/cases/:id`. Authorization is token-scoped to the
  ally; no owner-only data is exposed.
- The web client polls every 4s while the ally session is open and not yet
  connected. Acceptable for the demo; a push/subscription is a later option.
- Does not address the DSN-014-blocked auth plumbing (anon emulator auth gives
  one uid per browser context); real pairing still requires two distinct
  contexts/devices.

## Alternatives considered

### Accept-by-pairing-code (no discovery read)

Let the ally accept by presenting a code instead of an id. Rejected: the code
is issued by the ally and redeemed by the owner; reusing it for accept would
overload a single-use credential and still would not let the ally screen
*reflect* a pending invitation.

### Push/subscription instead of polling

A Firestore listener or server push would be more live. Rejected for now as
over-scope for the demo; the 4s poll is simple, stateless, and sufficient.

## Verification

- `apps/api/test/plan.test.ts`: `listInvitationsForAlly` scopes to the ally and
  excludes revoked/other-ally invitations; `GET /api/v1/ally/invitations`
  returns the nominated ally's invitation, reflects acceptance, carries no case
  data, and denies unauthenticated requests.
- `apps/web/src/App.test.tsx`: the ally session discovers an invitation,
  reflects it, and accepts via `POST ally-invitations/:id/accept`; a waiting
  state shows no actionable accept.
- `apps/web/src/PlanScreen.test.tsx`: waiting / invited / connected states.
