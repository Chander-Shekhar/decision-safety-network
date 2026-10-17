# 0020: LLM-produced procedure check + scoped alert-red for danger signals

- **Status:** Accepted
- **Date:** 2026-10-17
- **Owners:** Orchestrator / DSN-038
- **Related task:** DSN-038
- **PRD references:** Core MVP C3 (fact extraction), founder demo vision step 4 (AI claim verification)
- **Supersedes:** None
- **Superseded by:** None

## Context

Two founder directives on the Review ("What we heard") step:

1. The procedure-legitimacy call-out — "banks never ask you to move money to a safe account" — had been implemented as a hardcoded regex in the web layer. The founder has repeatedly required that detection *generalise across many scam shapes* and must not be hardcoded. Observed tactics were already LLM-produced (`extract()` asks Gemini for all `REQUIRED_FACT_FIELDS`); the procedure check was the one hardcoded exception and had to match.
2. The design palette (decision 0008) deliberately has **no red** ("warm amber, deliberately not red"), tied to the vision's "never add alarm" premise. The founder asked for red on exactly two elements: a public-listing result that *contradicts* the caller's claimed identity, and the "What we noticed" manipulation block.

## Decision

- **Procedure check is a model-extracted fact.** Add `procedureCheck` to `REQUIRED_FACT_FIELDS`. Bump the extraction prompt to `facts-extract-v2` and give Gemini explicit per-field guidance (`EXTRACT_FIELD_GUIDANCE`) for every field, including `procedureCheck` ("judge whether what the caller is asking for is a legitimate procedure for the organisation they claim… reason from THIS call, not a fixed list"), `observedTactics`, and `verificationStatus`. The web layer only *displays* the model's value as a "Procedure check" observation; the regex (`assessProcedure`/`ILLEGITIMATE_PROCEDURE`) is deleted. The value stays untrusted and source-grounded like any other fact and is only promoted to `confirmed` by the owner advancing the step.
- **Scoped `alert` red.** Add `--color-alert` / `--color-alert-soft` tokens, used only for (a) the `contradicts` web-evidence pill and (b) the "What we noticed" block. This is a deliberate, narrow override of decision 0008's amber-not-red rule, limited to genuine danger signals — not general state coloring.

## Consequences

- The procedure check now works for any scam shape the model recognises, not a keyword list; prompt changes (not code) tune it.
- Changing `REQUIRED_FACT_FIELDS` and the prompt version means the live Gemini smoke (DSN-039 runbook) should be re-run to confirm the model returns a useful `procedureCheck`; validation/tests are field-set-driven and already pass.
- `verificationStatus` remains extracted (feeds report/ally) but is hidden from the map UI (it read as meaningless to owners).
- Red now exists in the palette; future work must keep it scoped to real alerts, or it erodes the "never add alarm" posture.

## Alternatives considered

### Keep procedure check as a client-side rule

Rejected: cannot generalise, and the founder explicitly required LLM-driven detection. A regex also drifts from the actual transcript semantics.

### Reuse `observedTactics` to carry procedure legitimacy

Rejected: conflates "how they manipulated" with "is the ask itself a legitimate process" — the founder wanted the procedure verdict called out distinctly, and the vision treats it as a separate verification.

### Keep amber for the warning surfaces

Rejected per direct founder instruction; amber did not read as a strong-enough danger signal for a contradicted identity / detected manipulation.

## Verification

- `apps/web` `tsc --noEmit` clean; `vitest run` green (DecisionMap renders `procedureCheck` as an observation; verificationStatus hidden; contradicts pill carries the alert class).
- `apps/api` `tsc --noEmit` + `vitest run` green (`facts.test` is `REQUIRED_FACT_FIELDS`-driven and covers the new field via `validateFacts`).
- Live re-smoke of Gemini `extract` (DSN-039 runbook) to confirm a real `procedureCheck` value — pending.
