# 0021: Decide-step "call the real organisation" — an actionable, web-sourced number

- **Status:** Accepted
- **Date:** 2026-10-17
- **Owners:** Orchestrator / DSN-038
- **Related task:** DSN-038
- **PRD references:** Core MVP C7 (verification route / "never caller-supplied data, never an authoritative route"), founder demo vision steps 4–5 (AI claim verification, clear next steps)
- **Supersedes:** None
- **Superseded by:** None

## Context

On the Decide step, the "Verify officially" button only navigated to the separate Demo Bank Verify step; its card copy ("reach the real organisation yourself, using a number you look up") promised a user action it did not deliver, and the Verify step itself returns a hardcoded "claim not supported". The founder asked that this button become a **real action**: a phone number the owner can tap to call the organisation the caller claims to be (a bank, or any impersonated authority such as the police) — on a number *we* source, never one the caller supplied — and that the action be **hidden when no such number is found**.

This requires surfacing a web-sourced phone number as an **actionable route**, which is in deliberate tension with:

- **PRD C7** — the verification route "launches from the versioned registry, never caller-supplied data" and web verification is "labeled, untrusted supporting evidence, never an authoritative route".
- **DSN-026 / DSN-031** (`web-verification.ts`, `web-verification-adapter.ts`) — built so no provider text (names, numbers, URLs) ever reaches output (`officialRoute: null`), the claimed identity only *selects* from a closed curated institution table, and the grounding port is never shown caller free-text.

The guarded risk: a scammer who controls the transcript could try to steer DSN into surfacing an attacker-planted number as "the official number to call."

## Decision

Ship the actionable call button, **authorised by the founder** as a scoped override of the C7 "never an authoritative route" rule for this one action. Direct founder instruction (authority order #1) outranks the locked PRD; this record documents the override rather than silently crossing it.

Sourcing (`apps/api/src/official-contact.ts`, `OfficialContact` contract):

- **Demo Bank (fictional):** the number comes from the curated `DEMO_BANK_REGISTRY.contactNumber` (new field) — deterministic, so the Cup demo and the offline/curated build always show the button. Matches "hardcode the policy, not the flow."
- **Any real organisation:** an **open LLM web search** (`createGeminiOfficialContactLookup`, Google Search grounding) for that org's own official public contact number. Unlike DSN-031's sealed grounding, the claimed-identity text **is** forwarded to the model — the founder's explicit call: a real organisation's official listing outranks anything an attacker could realistically plant via SEO, and the defensive closed-table restriction was judged over-cautious for this action.
- **Never a source:** the caller-supplied number. The only inputs are the extracted claimed-identity text and the server's own demo registry. The returned number is re-sanitized to digits (optionally a leading `+`) by `toDialable`.

UI (`ActionConsole.tsx`): when `phoneNumber` is non-null, render a single click-to-call link (`<a href="tel:…">` "Call {organisation}") — just the button, no surrounding trust callouts or labels (founder: "JUST a button to call if number was found"). When null, render nothing. The separate Demo Bank Verify step is unchanged and still reachable via the stepper.

Wiring: `DSN_WEB_VERIFICATION=grounded` selects the live Gemini lookup (same flag as the web-verification adapter); otherwise the curated lookup resolves only Demo Bank and reports "no number" for every real org (button hidden). `POST /api/v1/cases/:id/official-contact` takes only `{ claimedIdentity }`; the Decide step calls it once per case/identity on entry.

## Consequences

- The Decide step now offers a genuine protective action — call the real organisation directly — instead of a dead navigation link.
- A web-sourced number can now reach the owner as an actionable route; the residual attacker-planted-number risk is accepted per founder direction. Mitigations retained: digits-only sanitation (no `tel:` injection), null-hides-the-action, and the number is never derived from the caller's own supplied contact.
- The curated Cup build is unchanged in behaviour except that Demo Bank now shows a callable number; real-org search only activates under `DSN_WEB_VERIFICATION=grounded` (live).
- DSN-026's untrusted supporting-evidence path (`officialRoute: null`) is **unchanged** — this is a separate module (`official-contact.ts`), not a loosening of that boundary.

## Alternatives considered

### Authoritative-source-only (constrain the search to the org's official domain / vetted helpline directory)

Recommended by the implementer and rejected by the founder as overly defensive: a large organisation's official pages outrank planted content, so the open search is acceptable and gives far broader coverage (any impersonated org, not a closed list).

### Keep it demo-registry-only, defer real-org search

Rejected: under-delivers the founder's explicit ask (police / government / arbitrary bank).

### Fix only the card copy

Rejected: leaves the button without a real action.

## Verification

- `apps/api` `tsc --noEmit` clean; `official-contact.test.ts` green (8 tests, pure — runs without the emulator): Demo Bank resolves from the registry regardless of the lookup; real-org numbers are sanitized; null / thrown / empty-identity / garbled-number all degrade to no-number.
- `apps/web` `tsc --noEmit` clean; `vitest run` green: ActionConsole shows the `tel:` call link only when a number is present and hides it otherwise.
- Live open-web search is not exercised by any test (needs DSN-014 cloud auth / grounding); re-run the live Gemini smoke after enabling `DSN_WEB_VERIFICATION=grounded` to confirm a real organisation returns a usable number.
