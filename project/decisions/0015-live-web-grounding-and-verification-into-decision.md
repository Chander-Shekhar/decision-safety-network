# 0015: Live open-web grounding seam + feeding sealed verification into the decision

- **Status:** Accepted
- **Date:** 2026-10-12
- **Owners:** Orchestrator (integrator); implements founder direction of 2026-10-12
- **Related task:** DSN-031
- **PRD references:** Part I — Decision 19 / C7 (open-web lookups as labeled untrusted evidence); Trust gate ("the actionable route still comes from curated records"); C6 (at most three grounded reasons); causal acceptance matrix
- **Refines:** [0013](0013-web-verification-swappable-adapter.md) (enables its documented live-grounding seam and splits the institution config)
- **Supersedes:** None
- **Superseded by:** None

## Context

Founder direction (2026-10-12), verbatim: *"the check should be there... For demo bank, can we hardcode it, yes. But keep things real... hardcoding should be the policy not the whole flow and it should feed into the decision system. So, definitely make the web check live and make things real."* And separately (Req G): verification should **reinforce and explain the Pause, not auto-lift it**.

0013 shipped the open-web check as a deterministic curated adapter with the live grounding kept as a documented-but-disabled seam, and left verification results purely informational (the deterministic policy's `unverified` signal was hardcoded `true` with a stale "no verification capability exists yet" comment). Two things had to change without weakening any honesty invariant: make the web check genuinely live, and let verification actually feed the decision.

Two hard constraints (carried from 0013) still bind:
1. **The sealed official path stays sealed.** `verifyWithDemoBank` remains the sole producer of a `VerificationResult` and is not widened to read caller/model/web input.
2. **Grounded web text is attacker-controlled** and must never reach a verdict, the UI, or storage; it never certifies a caller and never becomes the official route.

## Decision

### A. Make the open-web check live ("hardcode the policy, not the flow")

1. **Institution config split.** `CuratedInstitution` becomes a discriminated union: `fictional` institutions (Demo Bank, Demo Revenue Service) carry a hardcoded synthetic `numberPattern` — they have no real web presence, so their published-contact *policy* is the only thing hardcoded; `real` institutions carry an `officialDomain` and **no** pattern, deriving their verdict live from that authoritative source. The shipped `real` entry is a clearly-fictional `.example` stand-in (`demo-national-bank`); no real institution is named, listed, or contacted.
2. **Grounding boundary.** A narrow `OfficialSourceGrounding.checkNumber({ displayName, officialDomain, normalizedNumber }) → NumberMatch` is the live seam, implemented by `gemini.ts`'s `createGeminiOfficialSourceGrounding()` (Google Search grounding, `temperature: 0`, closed-enum `responseJsonSchema`, Zod-revalidated, lazily constructed client). `createGroundedWebVerificationAdapter(grounding)` resolves a real institution against its official source and keeps a fictional one on its hardcoded pattern.
3. **Injection boundary preserved.** The hostile `claimedIdentity` only ever *selects* an institution from the closed curated table (worst case: it names a curated one); it is **never** forwarded into the grounding prompt — only the server-curated `displayName`/`officialDomain` plus the normalized number are. `sanitizeWebLookup` still rebuilds the result from only a curated institution key + closed `numberMatch` enum, discarding all provider text. The founder's own argument holds here: an attacker cannot replace a real institution's official site, and the lookup is constrained to that official source.
4. **Selection, not a default flip.** `server.ts`'s `selectWebVerificationAdapter()` enables the grounded adapter only when `DSN_WEB_VERIFICATION=grounded`; the deterministic curated adapter stays the default for evals, injection tests, and the Cup demo. Live grounding runs only where cloud Gemini + grounding are provisioned (DSN-014); it is built and fake-tested here, not run live.

### B. Feed verification into the decision (reinforce + explain, never lift)

5. **Only the sealed, trusted result touches policy.** `payment.ts` derives a `verifiedBankPolicyContradictsRequest` signal (via `deriveVerifiedBankPolicyRebuttal`) **solely** from the sealed `VerificationResult` (the bank's verified policy: never makes outbound fraud calls, never requests protected transfers). Untrusted open-web evidence is deliberately **not** a policy signal — it remains labeled untrusted supporting evidence in the UI only.

   **Constant-ness is intentional and honest (per DSN-031 adversarial review Finding 1).** For the Cup Demo Bank registry those two policy fields (`outboundFraudCall`, `protectedTransferRequested`) are hardcoded `false` by their sole producer, so the derived signal is effectively true whenever any sealed demo-bank verification is present alongside `cues && unverified`. This is deliberate: the signal is **not** a per-call "the caller claimed to be the bank" comparison, and the reason text was reworded accordingly (it never asserts the caller impersonated the bank — only that the request *runs against the bank's own verified policy*, which is a constant, true fact). The signal never inspects the caller's claimed identity, so it cannot over-attribute impersonation; it only reinforces caution it is already entitled to show.
6. **It upgrades one existing reason, never adds a fourth.** When the sealed policy contradicts a pressured, unverified transfer, `assessCase` upgrades the fixed text of the existing `unverified-claim` reason and attaches the verification's `verificationRef` (`<bankId>@<registryVersion>`). This respects PRD C6 (at most three reasons shown); it never introduces a new reason code the UI would silently drop.
7. **Load-bearing honesty invariants.** The signal **never** changes the selected phase, **never** lifts a Pause, and **never** flips `unverified` to false — the claimed identity stays unverified; the sealed result reports bank *policy*, not caller identity (it has no `certifiesCaller` field). The stale `deriveConversationSignals` comment is corrected to say exactly this.

## Consequences

- **Positive:** a genuinely live "we checked the official source" moment for a real-shaped institution, and a trusted verification result that visibly reinforces and explains why a Pause stands — both satisfying the founder's direction without weakening any seal. Injection resistance and the sealed route stay provably unaffected (tests: hostile adapter/grounded text and hostile `claimedIdentity` change nothing; a sealed contradiction never lifts the Pause and never adds a 4th reason).
- **Cost / follow-up:** the live grounding path is cloud-gated and fake-tested only; a real deployment must provision Gemini grounding and supply a genuine `officialDomain` per real institution, and validate that structured output + grounding behave together on the live endpoint. The grounded `real` entry remains a fictional placeholder until then.

## Alternatives considered

- **Let untrusted web evidence drive the policy phase:** rejected — that is exactly the injection surface 0013 fenced off. Only the sealed result may touch the deterministic decision; web stays untrusted supporting evidence.
- **Add a new `verification-contradicts` reason code:** rejected — the UI caps at three reasons (PRD C6), so a 4th would be dropped; upgrading the existing `unverified-claim` reason surfaces the reinforcement reliably and keeps the claim honestly labeled unverified.
- **Let a sealed verification lift the Pause / mark the claim verified:** rejected — contradicts Req G and the trust model; the sealed result reports bank policy, never caller identity, so it can only reinforce caution.
- **Enable grounded as the default:** rejected — non-reproducible evals and a live demo dependency; kept env-selectable behind the curated default.
