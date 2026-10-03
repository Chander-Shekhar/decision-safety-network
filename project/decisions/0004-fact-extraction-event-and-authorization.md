# 0004: Fact extraction is owner-authorized, idempotent, and event-emitting

- **Status:** Accepted
- **Date:** 2026-10-03
- **Owners:** Integrator (orchestration session)
- **Related task:** DSN-006 (scoped fix after review)
- **PRD references:** C3 living source-linked case (auditable provenance); C12 consent/authorization
- **Supersedes:** None
- **Superseded by:** None

## Context

DSN-006's independent review found two coupled problems in the fresh-extraction
path (`POST /api/v1/cases/:id/facts/extract` → `extractFacts`):

1. **Authorization ordering.** The route read the case's persisted transcript
   segments and invoked `gemini.extract(segments)` *before* any ownership check;
   ownership was only verified inside the later commit transaction. Because the
   Firebase Admin SDK bypasses Firestore rules, any authenticated non-owner
   could trigger a live model pass over another owner's private transcript —
   unauthorized processing of someone else's PII plus a cost/abuse vector —
   even though trusted state and returned data stayed protected (the transaction
   throws `FORBIDDEN`, so nothing is corrupted or disclosed).

2. **Version bump without an event.** Every successful extraction did
   `tx.update(caseRef, { facts, version: version+1 })` but wrote **no**
   `CaseEvent`. In this codebase every other version transition
   (`appendSegment`, `correctFact`, `confirmFact`, `commitCaseCommand`) emits a
   `CaseEvent`, so the event log is the complete audit of version transitions —
   a property the PRD's provenance/recovery/export features (DSN-012/013) rely
   on. A silent bump breaks that invariant. It also made the shared `version`
   (the optimistic-concurrency token for the owner's manual correct/confirm)
   advance on every extraction pass, so a background extraction landing between
   the owner reading facts and submitting a correction would fail that
   correction with `VERSION_CONFLICT` for no user-visible reason.

Facts in the `facts` map are model-extracted and never trusted state; only
`confirmed` (set by the owner's `correctFact`/`confirmFact`) is trusted. That
property is correct and is preserved by this decision.

## Decision

The extract path must satisfy three rules:

1. **Owner-authorized before any work.** Verify the case exists and
   `ownerUid === uid` (and that the session is not closed) BEFORE reading
   transcript segments and BEFORE calling `GeminiPort.extract`. A non-owner
   receives `FORBIDDEN` with zero model calls and zero segment reads. The commit
   transaction still re-checks owner, `sessionClosed`, and `expectedVersion`
   authoritatively (defense in depth / no TOCTOU on version).

2. **Idempotent.** Compute the merged `facts` projection and compare it to the
   current one. If extraction does not change the `facts` map, commit nothing:
   no `version` bump, no event. This stops no-op passes from racing the owner's
   manual-control OCC.

3. **Event-emitting when it changes state.** When the `facts` map does change,
   bump `version` by one AND write exactly one `CaseEvent` for that transition,
   consistent with the existing event shape (`result = { id, version, phase }`),
   recording which fact fields changed and their source segment ids. The event
   carries metadata only and MUST NOT contain raw transcript text (matching the
   session events' privacy posture). This keeps the event log a complete audit
   of every version transition.

The shared case `version` remains the single OCC token (no parallel
facts-revision counter): a genuine facts change SHOULD invalidate an in-flight
manual edit so the owner re-reads and confirms against current facts; rule 2
ensures only genuine changes do so.

## Consequences

- Positive: no unauthorized model processing of another owner's data; the event
  log remains a complete, auditable record of all version transitions (unblocks
  DSN-012 recovery and DSN-013 export relying on it); spurious `VERSION_CONFLICT`
  from no-op extractions is eliminated.
- Cost: one extra case read on the extract path before the model call; a
  deep-ish comparison of the facts map; one additional event document per
  state-changing extraction.
- Follow-up: DSN-008's `relate`-driven recheck and DSN-012/013 should read the
  extraction events like any other case event.

## Alternatives considered

### Keep ownership only in the commit transaction
Rejected: the model call and segment read happen before the transaction, so the
abuse/PII-exposure window remains. The check must precede the model call.

### Introduce a separate facts-revision counter decoupled from `version`
Rejected for the MVP: adds a second concurrency token and more surface area. The
idempotent-only-on-change rule already removes the spurious-conflict problem,
and sharing `version` keeps manual edits correctly ordered against real facts
changes.

### Bump `version` on every extraction and emit an event every time
Rejected: no-op extraction passes would still race manual controls and would
pad the audit log with empty transitions.

## Verification

- A non-owner POST to the extract route returns `FORBIDDEN`/403 AND the fake
  `GeminiPort.extract` call counter stays at 0 (new test).
- A state-changing extraction bumps `version` by one and writes exactly one
  `CaseEvent`; a re-extraction producing identical facts bumps neither and
  writes no event (new/updated tests).
- Existing stale-version (`STALE_EXTRACTION`), post-revocation
  (`CONSENT_REQUIRED`), fabricated-citation, injection, and correction-precedence
  tests continue to pass; full API/web suites green.
