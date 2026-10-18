# 0014: Pre-filled 1930/NCRP report — confirmed-facts-only draft, user-opens-the-channel handoff

- **Status:** Accepted
- **Date:** 2026-10-12
- **Owners:** Orchestrator (integrator); implements founder-locked Decision 18 / C11 under [0010](0010-cup-scope-amendment-2026-10-11.md)
- **Related task:** DSN-028
- **PRD references:** Part I — Decision 18; C11 (pre-filled report the user reviews and submits); Trust gate (NCRP field-map, "not submitted" until the user acts); non-goal (no unattended submission)
- **Refines:** the fraud-list privacy/basis discipline in [0011](0011-confirmed-fraud-list-hashing-and-retention.md) and the minimal-ZIP export in [0005](0005-dsn013-minimal-zip-writer.md)
- **Supersedes:** None
- **Superseded by:** None

## Context

C11 (locked under 0010) replaces the earlier "preview only" evidence framing with a **pre-filled official 1930/NCRP report the user reviews and submits themselves**. The open question left for integration was the **handoff mechanism** — how the user gets from the draft to a submitted report — and how to populate fields without the product ever overclaiming (fabricating fields, submitting on the user's behalf, or asserting a report was filed/accepted).

Two hard constraints shaped the choice:

1. **The product must never submit, file, or confirm receipt.** The locked non-goal forbids unattended submission; the honesty invariant forbids claiming a report was filed or accepted. A human must perform the actual submission in the official channel.
2. **The DSN-024 `authority-report` fraud-list basis has a real precondition.** `addConfirmedFraud` with `basis:'authority-report'` throws `REPORT_NOT_RECORDED` unless the case carries a `recoveryAcknowledgement` with `action:'helpline-1930'` (`fraud-list.ts`). That precondition must be satisfied legitimately through the existing recovery acknowledgement path, never bypassed, and the list entry is never published.

## Decision

1. **Draft built from confirmed facts only; unknowns stay blank.** `buildReportDraft` is pure and populates a field only from `CONFIRMED_ORIGINS` (user-confirmed / user-corrected / reported). Model-origin values and NCRP fields with no supported case mapping are left blank, never guessed. Each filled field carries provenance; the draft is source-dated and version-stamped against the field-map.
2. **"Not submitted" is in the type, not just the UI.** `ReportDraft` carries literal `submitted:false`, `simulated:true`, and `label = REPORT_DRAFT_LABEL` ("Draft for your review — not submitted"); `ReportHandoff` carries `mechanism:'user-opens-official-channel'`, `simulated:true`, `requiresUserAction:true`, and a fictional non-resolving `channelUrl` (`…invalid`). No request body field can flip these.
3. **The handoff is a human action, in order.** `recordReportHandoff` runs server-side first: validate the optional `callerNumber` (`normalizeNumber`, 400 `INVALID_BODY`), record the recovery acknowledgement via the existing `recordAcknowledgement(action:'helpline-1930')` (409 `NOT_IN_RECOVERY` outside the Recover phase), then add the `authority-report` fraud-list entry via the existing `addConfirmedFraud`. Only after that 200 does the web client call `window.open(channelUrl)` so the **user** opens the official channel. `ReportHandoffResult` states `handedOff:true, filed:false` and never asserts the report was received or accepted.
4. **The existing precondition is honored, not rewritten.** The route composes `recordAcknowledgement` + `addConfirmedFraud`; `fraud-list.ts` / `screening*` are untouched. If the case is not in Recover, the acknowledgement fails first and no list entry is written — the precondition is satisfied legitimately or the handoff does not record.
5. **Download is a separate, equal path.** `GET …/report-draft/download` returns the same confirmed-facts-only draft as an attachment HTML form so the user can review offline and enter it in the official channel themselves; it records nothing and submits nothing.

## Consequences

- **Positive:** a credible "here is your pre-filled 1930/NCRP report" moment that stays honest by construction — nothing is submitted or confirmed by the app, unknown fields are visibly blank, the recovery-scam warning is present, and the fraud-list entry only lands when the real recovery acknowledgement precondition is met. Proven by direct API tests (outside-Recover → 409 and no list entry; invalid number → 400).
- **Cost / follow-up:** the NCRP field-map is a curated, source-dated subset; a real deployment needs the authoritative current field set and a real official-channel endpoint in place of the `…invalid` placeholder. The handoff is deliberately not idempotency-replay-tested at the integration layer (recorded as a DSN-028 deferred nit).
- The handoff records the acknowledgement + list entry as a side effect of the user's explicit "Open official channel" action; it is gated on the Recover phase in both API (409) and UI (`handoffAllowed`), so it cannot fire from an arbitrary step.

## Alternatives considered

- **Deep-link / auto-fill into the real NCRP portal:** rejected for the Cup build — the authority side is simulated; a fictional non-resolving `channelUrl` keeps the "user opens it themselves" honesty without implying a live integration. Kept as the obvious real-deployment seam.
- **Record the `authority-report` list entry on draft generation:** rejected — that would write a fraud-list entry without the user's explicit submit action and could run outside Recover. The entry is tied to the explicit handoff and the existing acknowledgement precondition.
- **Fill unknown fields with best-effort model guesses:** rejected — fabricating report fields is the exact overclaim C11 forbids; unknowns stay blank with the gap visible.
