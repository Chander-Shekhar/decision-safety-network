# 0013: Open-web claim verification — swappable adapter, deterministic default, grounding seam

- **Status:** Accepted
- **Date:** 2026-10-12
- **Owners:** Orchestrator (integrator); implements founder-approved Decision 19 / C7 under [0010](0010-cup-scope-amendment-2026-10-11.md)
- **Related task:** DSN-026
- **PRD references:** Part I — Decision 19; C7 (open-web lookups as labeled untrusted evidence); Responsibility boundary; Trust gate ("the actionable route still comes from curated records")
- **Refines:** the untrusted-supporting-evidence discipline established for DSN-024 in [0011](0011-private-fraud-list-privacy-and-retention.md)
- **Supersedes:** None
- **Superseded by:** None
- **Refined by:** [0015](0015-live-web-grounding-and-verification-into-decision.md) (enables the live grounding seam, splits the institution config, and feeds the sealed verification into the decision)

## Context

C7 (approved under 0010) asks the product to check a caller's claimed identity against public web information and surface the result as **labeled, untrusted supporting evidence** — e.g. "this number does not match the institution's published contact pattern." The open question left for integration was the **mechanism**: a live grounded model lookup (Google AI grounding via the existing `GeminiPort`) versus a deterministic curated adapter.

Two hard constraints shaped the choice:

1. **The sealed official path must stay sealed.** `verifyWithDemoBank` is the sole producer of a `VerificationResult` and launches only from the versioned `DEMO_BANK_REGISTRY`; it never reads caller/transcript/model/web input. That seal *is* the "actionable route from curated records" trust gate. Web evidence must be a separate surface that can corroborate or contradict a claim but can never become the official route and never self-certify a caller.
2. **Grounded web text is attacker-controlled.** A caller names an institution; pages the model would read can contain injected instructions, fake "official" numbers, and fake certifications. If free provider text reached the verdict or the UI, the demo would be trivially manipulable — the exact overclaim C7 warns against.

## Decision

1. **Swappable adapter.** Define a `WebVerificationAdapter` interface (`lookup({ claimedIdentity, normalizedNumber }) → RawWebLookup`), mirroring DSN-024's `CallerIdAdapter`. The route factory takes the adapter by injection, defaulting to the curated implementation.
2. **Deterministic curated default ships in the Cup build.** `createCuratedWebVerificationAdapter()` matches the claimed identity against a curated table of fictional institutions (Demo Bank, Demo Revenue Service) and tests the normalized number against that institution's synthetic published-number pattern. An identity that names zero or several institutions yields no verdict (`inconclusive`). This keeps evals, injection tests, and the demo reproducible.
3. **Live grounding is a documented seam, not enabled.** A live implementation (Google AI grounding via `GeminiPort`) satisfies the same interface and may only be asked "does this number fit the public contact pattern of `<curated institution key>`?", returning a `RawWebLookup`. It is injected via `createWebVerificationRoutes(adapter)` / `createVerificationRoutes(adapter)`; `server.ts` is untouched.
4. **The adapter's return is untrusted and re-normalized server-side.** `sanitizeWebLookup` rebuilds the lookup from only a curated `institutionKey` (unknown keys dropped) and a closed `numberMatch` enum; every other field is discarded. All output text is server templates plus the curated display name and a masked number — no provider or claimed-identity text ever reaches the evidence or storage.
5. **Honesty is in the type, not just the UI.** `WebVerificationEvidence` carries literal `trust:'untrusted'`, `simulated:true`, `officialRoute:null`, `certifiesCaller:false`; no request body field can set them. The route imports nothing from `verification.ts`, mutates no case phase/version/events, and is owner-checked. Stored evidence holds the masked number only, never the raw number or the claimed-identity text.

## Consequences

- **Positive:** a live-feeling "we checked public listings" moment that can contradict a scammer's claim, with injection resistance proven by test (a hostile adapter returning an attacker number / "ignore previous instructions" / fake certification changes nothing in the response or case state) and the official route provably unaffected. Reproducible for evals.
- **Cost / follow-up:** the curated table is synthetic and small (two fictional institutions); a real deployment would enable the grounding seam and provision it, and would need a real published-number source. The injection tests currently live in `apps/api/test/web-verification.test.ts`; they fold into the DSN-015 eval injection set when that lands.
- The number-pattern match is a plausibility signal only ("the number looks plausible / does not match the listing"), never an identity confirmation — the copy says so explicitly.

## Alternatives considered

- **Live grounded lookup as the default:** rejected for the Cup build — non-reproducible evals, non-deterministic injection tests, and a live dependency in the demo path. Kept as an injectable seam behind the same interface.
- **Let grounded page text flow into the verdict/UI:** rejected — that is the injection surface; the sanitizer deliberately discards all provider text and keeps only a curated key + closed enum.
- **Extend the sealed `verifyWithDemoBank` to also consult the web:** rejected — it would breach the "actionable route from curated records" seal. Web evidence is a strictly separate, untrusted surface.
