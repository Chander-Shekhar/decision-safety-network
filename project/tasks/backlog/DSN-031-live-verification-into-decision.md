# DSN-031: Live open-web verification + feed verification into the decision

- **Scope:** core (de-hardcoding pass — founder-directed)
- **Priority:** P1
- **Owner:** _(unclaimed)_
- **Branch/worktree:** _(to claim)_ `task/DSN-031-live-verification-into-decision`
- **Owned paths (planned):** `apps/api/src/web-verification-adapter.ts` (institution config restructure + live grounding adapter), `apps/api/src/gemini.ts` (additive grounded lookup), `apps/api/src/web-verification-routes.ts` / `verification-routes.ts` (adapter selection), `apps/api/src/policy.ts` (new grounded reason code), `apps/api/src/payment.ts` (verification signal derivation; fix stale `unverified:true`), additive `packages/contracts/src/*` as needed, `apps/web/src/App.tsx` (surface the reinforcing reason). Serialized: `verification.ts` (sealed `verifyWithDemoBank`) stays the sole `VerificationResult` producer and is NOT widened to read web input.
- **Dependencies:** DSN-030 (shares `gemini.ts` + `App.tsx`; sequence after).
- **PRD references:** Part I — Decision 19 / C7 (open-web lookups as labeled untrusted evidence); Trust gate ("the actionable route still comes from curated records"); causal acceptance matrix (reasons).
- **Decision references:** refines 0013 (enable the live grounding seam; hardcode only the fictional Demo Bank policy, derive a real bank from the official-domain-constrained live lookup); new decision for feeding verification into the decision.

## Outcome

Founder direction (2026-10-12): "hardcoding should be the policy not the whole flow and it should feed into the decision system. So, definitely make the web check live and make things real." The open-web check becomes genuinely live (Gemini grounding constrained to the institution's official source); only the fictional Demo Bank's policy/pattern stays hardcoded (it has no real web presence); a real bank config derives its verification from the live lookup. The sealed `verifyWithDemoBank` policy and the (untrusted) web evidence feed the decision as a grounded reason that **reinforces and explains** the Pause — never auto-lifts it, and web evidence never flips `unverified` to false.

## Boundaries

- Included: live grounding adapter behind the existing `WebVerificationAdapter`; institution config split (curated fictional pattern vs. real-bank official-domain lookup); adapter selection; keep `sanitizeWebLookup` + `trust:'untrusted'`/`officialRoute:null`/`certifiesCaller:false`; a new `GroundedReason` that explains why the Pause stands when verification contradicts the claim; fix `deriveConversationSignals`' stale `unverified:true`.
- Excluded: widening the sealed `verifyWithDemoBank`; letting web/grounded text set trust, lift a Pause, or mark a claim verified; real cloud provisioning (live grounding is built + fake-tested; runs live only where cloud Gemini + grounding are provisioned).

## Acceptance checks

- [ ] Live grounding adapter satisfies `WebVerificationAdapter`, is asked only "does this number fit `<institution key>`'s official published contact pattern?", returns `RawWebLookup`; sanitizer still drops all provider text.
- [ ] Demo Bank resolves via the curated fictional pattern; a real bank config resolves via the official-domain-constrained live lookup; no scenario-specific literal elsewhere.
- [ ] A verification/web contradiction adds a grounded, source/record-cited reason that reinforces and explains the Pause; it never lifts a Pause and never sets `unverified:false`.
- [ ] Injection tests still pass (hostile adapter / grounded text changes nothing in response, case state, or the sealed route).
- [ ] API + web suites green; typecheck clean; independent reviewer READY.

## Verification evidence

_(filled at completion)_
