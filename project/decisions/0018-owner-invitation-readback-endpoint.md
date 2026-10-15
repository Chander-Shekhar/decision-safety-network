# 0018: Owner-keyed invitation read-back endpoint

- **Status:** Accepted
- **Date:** 2026-10-15
- **Owners:** Orchestrator / DSN-036
- **Related task:** DSN-036
- **PRD references:** Core MVP Safety Ally pairing
- **Supersedes:** None
- **Superseded by:** None

## Context

Decision 0017 wired the ally side of pairing: a nominated ally can now discover
and accept an invitation. But the owner side had the mirror-image gap. When the
owner redeems a pairing code the web client set `allyStatus = 'invited'` as
local state only, and there was no owner-keyed read of the `allyInvitations`
collection and no owner-side poll. Acceptance is written by the ally on a
separate device/context (`acceptInvitation` sets `acceptedAt`), so the owner
session never learned it happened and sat at "nominated, awaiting acceptance"
forever — even though the acceptance was correctly persisted in Firestore (the
ally's own screen reflected it).

## Decision

Add one owner-keyed read: `GET /api/v1/owner/invitations`, returning the
authenticated owner's currently-active (unrevoked) invitations
(`listInvitationsForOwner`, scoped strictly to the token's `ownerUid`). It
returns the existing detail-free `AllyInvitation` shape (id, the two UIDs,
accepted/revoked timestamps) and carries no case data — the exact mirror of
`GET /api/v1/ally/invitations`. The web owner session polls it (every 4s) once a
real ally has been nominated, reflecting `invited` → `ready` when `acceptedAt`
appears. The poll is gated on the client-only sample ally being cleared; a
stored `plan.nominatedAllyUid` clears that flag on load, so the owner's status
is restored correctly on reload too. No change to the invitation data model.

## Consequences

- Closes the pairing loop in both directions: the owner now sees acceptance
  without any manual refresh.
- Adds one authenticated read route under an `/owner/` namespace, symmetric to
  `/ally/invitations`. Authorization is token-scoped to the owner; no other
  party's data is exposed.
- The web client polls every 4s while an owner session has a real (non-sample)
  nomination that is not yet accepted. Acceptable for the demo; a
  push/subscription is a later option (same trade-off recorded in 0017).
- The sample-ally demo state is untouched: with no real nomination the poll
  never runs, so the pre-added "Ally ready (sample)" presentation is preserved.

## Alternatives considered

### Fold readiness into `GET /api/v1/plan`

Return a derived `allyReady` flag on the plan read and have the owner re-poll
`plan`. Rejected: it overloads the plan contract (DSN-023 plan v2) with a
derived, non-stored field and couples ally readiness to plan reads; a dedicated
owner-keyed invitation read is symmetric with 0017 and keeps the plan document
a pure settings record.

### Push/subscription instead of polling

A Firestore listener or server push would be more live. Rejected for now as
over-scope for the demo; the 4s poll is simple, stateless, and sufficient —
consistent with the decision taken for the ally side in 0017.

## Verification

- `apps/api/test/plan.test.ts`: `listInvitationsForOwner` scopes to the owner,
  reflects acceptance, and drops revoked invitations; `GET /api/v1/owner/invitations`
  returns the owner's pending invitation, reports it accepted after the ally
  accepts, carries no case data, and denies unauthenticated requests.
- `apps/web/src/App.test.tsx`: an owner session with a real nomination polls
  `owner/invitations` and shows "Ally ready" once accepted, and "awaiting
  acceptance" while pending.
