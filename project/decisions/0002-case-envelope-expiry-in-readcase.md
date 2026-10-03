# 0002: Case expiry gating lives in the foundation CaseEnvelope/readCase

- **Status:** Accepted
- **Date:** 2026-10-03
- **Owners:** Integrator orchestrator (DSN-003)
- **Related task:** DSN-003 (consumed by DSN-005, DSN-011, DSN-012, DSN-013)
- **PRD references:** C12 trust/failure/privacy; retention/expiry constraints
- **Supersedes:** None
- **Superseded by:** None

## Context

Plan Task 1 Step 4 specifies that `readCase` "checks owner and expiry before returning," and a global constraint requires every direct API read to reject at `expiresAt`. The initial DSN-003 implementation omitted expiry because the Task 1 `CaseEnvelope` had no `expiresAt` field. Feature tasks (DSN-005/011/012/013) must not edit the serialized foundation files, so if expiry gating is left out of `readCase`, the central authenticated read path would never reject expired cases even after DSN-013 adds retention/expiry — breaking those tasks' acceptance (direct API reads returning 404/410 at expiry, no identifiable descendants after close).

## Decision

Amend the shared foundation contract now, inside DSN-003's owned paths: add an optional `expiresAt?: string` (ISO) to `CaseEnvelope`; `readCase<T>` throws `EXPIRED` (mapped to HTTP 410 in `app.ts`) when `expiresAt` is set and the current time is at or past it, after the owner check. `createCase` leaves `expiresAt` unset. DSN-013 later sets `expiresAt` on close/retention and relies on this central gate rather than re-implementing it.

## Consequences

- Positive: single enforcement point for expiry on the authenticated read path; downstream retention/deletion tasks inherit correct behavior without editing serialized foundation files.
- Positive: keeps the foundation faithful to the plan's stated `readCase` contract.
- Cost/follow-up: `CaseEnvelope` is a shared contract; the optional field is additive and backward-compatible, but DSN-013 must still physically delete expired data (expiry read-gating is not deletion). Ally reads (DSN-011) must apply the same gate on their separate route.

## Alternatives considered

### Defer expiry to each feature task's own read paths

Rejected: `readCase` is the shared read path used across tasks; duplicating expiry logic per feature risks inconsistent gating and an existence/data-leak gap, and the plan already assigns the check to `readCase`.

## Verification

DSN-003 adds a `case-store.test.ts` case: a case with a past `expiresAt` → `readCase` throws `EXPIRED` / route returns 410; a future/unset `expiresAt` → returns normally. Re-reviewed independently before integration. DSN-013 acceptance later confirms expiry blocks owner/ally/export reads.
