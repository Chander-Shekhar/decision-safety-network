# 0011: Private confirmed-fraud list — privacy, identifier hashing, and retention

- **Status:** Accepted
- **Date:** 2026-10-11
- **Owners:** Orchestrator (integrator); refines founder-approved C13 / decision [0010](0010-cup-scope-amendment-2026-10-11.md)
- **Related task:** DSN-024
- **PRD references:** Part I — C13 (private confirmed-fraud list); External-signals scope row; Responsibility boundary; Trust/safety/privacy gates; non-goal (no public blacklist)
- **Supersedes:** None (refines the privacy treatment of C13, already approved under 0010)
- **Superseded by:** None

## Context

C13 (approved under decision 0010) introduces a private confirmed-fraud list: identifiers added only on user confirmation or an authority report, used to warn the same owner before pickup on future calls, never public and never criminal attribution. The feature is approved; its privacy *treatment* was not specified. DSN-024's independent review surfaced two concrete gaps in the first implementation:

1. The list document ID was an unsalted SHA-256 of the phone number. A mobile number's keyspace (~10^9–10^10) makes an unsalted hash trivially reversible, so the stored record is not meaningfully masked — it is a recoverable record of a caller identifier.
2. The list had no deletion or forget path. Entries outlived the owning case indefinitely, including when the owner's plan retention mode is `delete-on-close`, with a dangling `caseId` and no way for the owner to remove them.

The list's purpose is inherently cross-case and durable: it must survive the case that created it in order to warn about a *future* call. So the fix is not "purge it with the case" — it is to make the durability deliberate, consent-governed, non-reversible, and owner-revocable.

## Decision

1. **Non-reversible identifier.** The list key is a keyed **HMAC-SHA256** of the normalized number using a server-held secret (environment / secret manager; a clearly-marked dev default that is never committed), not a bare hash. This keeps lookups deterministic while making the stored key non-reversible without the secret. The human-readable field remains a **masked** display number only (e.g. last digits); the raw number is never stored.

2. **Deliberately durable, consent-governed, owner-scoped.** The list is intentionally retained beyond the lifetime of any single case because its function is to warn on future calls. It is scoped strictly per owner (`fraudLists/{uid}/...`), is never exposed to other users or made public, and is populated only on explicit user fraud-confirmation or a recorded authority report — never automatically from a raw caller-ID signal.

3. **Owner forget path.** The owner can remove a single entry and clear the whole list through a dedicated owner-scoped API route. The list is therefore exempt from the case retention sweep by design, but is not exempt from the owner's control.

4. **Not an official route, not certification.** List membership is untrusted supporting evidence that produces a "previously reported by you" warning only. It never becomes the actionable official verification route and never certifies a caller as fraudulent in any authoritative sense.

## Consequences

- **Positive:** the stored list is non-reversible, owner-controlled, and consistent with C13's "private, consent-governed, scoped to suspected identifiers" framing; the durable-across-cases behavior the feature needs is now explicit rather than an accidental retention exemption.
- **Cost / follow-up:** introduces a server secret dependency (HMAC key) that must be provisioned in any real deployment; adds owner forget/clear routes and their tests. The `authority-report` population basis is wired at the API but not yet in the UI — it lands with the reporting work (DSN-028); until then the list is populated via the user-confirmed path.
- The `authority-report` basis is a simulated local acknowledgement (the user chose the 1930 step); `callerNumber` is owner-supplied and not cryptographically bound to the case. Acceptable because the list is the owner's own private warning store, not an external accusation.

## Alternatives considered

### Purge the list with the case (treat it like case content)

Rejected: it would defeat the feature. A list that is deleted when its originating case closes cannot warn about a future call, which is the entire point of C13.

### Accept the reversible unsalted hash as-is

Rejected: it silently breaks the "masked only" / private property for a trivially-reversible keyspace, which undercuts the C13 privacy claim the demo makes.
