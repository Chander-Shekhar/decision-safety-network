# DSN-031: Live open-web verification + feed verification into the decision

- **Scope:** core (de-hardcoding pass — founder-directed)
- **Priority:** P1
- **Owner:** Orchestrator (integrator)
- **Branch/worktree:** `task/DSN-031-live-verification-into-decision` (started 2026-10-12)
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

- [x] Live grounding adapter satisfies `WebVerificationAdapter` via `createGroundedWebVerificationAdapter(grounding)`; the grounding seam `OfficialSourceGrounding.checkNumber({ displayName, officialDomain, normalizedNumber })` is asked only "does this number fit the official source?" (closed `NumberMatch` enum, Zod-revalidated); `sanitizeWebLookup` still drops all provider text. (`web-verification.test.ts` DSN-031 describe, 5 cases.)
- [x] Demo Bank (fictional) resolves via its hardcoded synthetic `numberPattern`; a `real` institution (`demo-national-bank`, `.example` placeholder) resolves via the official-domain-constrained live lookup; the curated default reports `unknown` for a real institution (it needs the live source). No scenario-specific literal elsewhere.
- [x] A sealed verification whose bank policy rebuts the pressured request reinforces and explains the Pause by upgrading the existing `unverified-claim` reason's text and citing `verificationRef` — **not** a new reason code (PRD C6 caps at three shown; a 4th would be dropped by the UI). It never lifts a Pause, never changes the phase, and never sets `unverified:false`. Only the sealed, trusted result feeds policy; untrusted web evidence stays UI-only. (`policy.test.ts` + `payment.test.ts` DSN-031 cases.)
- [x] Injection tests still pass: hostile adapter / grounded text and hostile `claimedIdentity` change nothing in the response, case state, or the sealed route; the claimed-identity text is never forwarded into the grounding prompt.
- [x] API + web suites green; typecheck clean; independent adversarial review returned one MEDIUM honesty finding (addressed — see below).

## Verification evidence

**Commands / results (2026-10-12):**
- `npm run typecheck` — clean (contracts, api, web).
- `npm --workspace apps/web run test` — 22 files, **201/201 passed**.
- `firebase emulators:exec --project demo-dsn --only auth,firestore "npm --workspace apps/api run test"` — 22 files, **422/422 passed** (+11 over the pre-DSN-031 baseline of 411). `MetadataLookupWarning` lines are the emulator's benign no-network metadata probe.

**Changed paths:** `apps/api/src/web-verification-adapter.ts` (institution config discriminated union + grounded adapter), `apps/api/src/gemini.ts` (additive `createGeminiOfficialSourceGrounding`, lazy client), `apps/api/src/server.ts` (`selectWebVerificationAdapter`, env-gated), `apps/api/src/policy.ts` (`verifiedBankPolicyContradictsRequest` + `verificationRef` reinforce the `unverified-claim` reason), `apps/api/src/payment.ts` (`deriveVerifiedBankPolicyRebuttal`, corrected stale `deriveConversationSignals` comment), `packages/contracts/src/payment.ts` (`PaymentReason.verificationRef`), tests (`web-verification.test.ts`, `policy.test.ts`, `payment.test.ts`), `project/decisions/0015-*.md` (new, Accepted), `project/decisions/0013-*.md` (Refined-by link).

**Commits:** `0f26908` (claim) · `7f5cea1` (live grounding seam + feed verification into decision) · `c94a9f5` (decision 0015) · `1e5aab8` (honesty fix — reword to bank-policy rebuttal).

**Independent review:** adversarial reviewer confirmed all 7 load-bearing invariants HOLD (sealed `verifyWithDemoBank` not widened; untrusted web never touches policy; no Pause lifted; no 4th reason; `unverified` never flipped; injection boundary intact; claimed-identity never forwarded to grounding). One MEDIUM honesty finding: the derived "contradiction" is constant (the registry policy fields are hardcoded `false`), so the prior reason text over-attributed bank impersonation. **Addressed** in `1e5aab8`: renamed the signal to `verifiedBankPolicyContradictsRequest`, reworded the reason to state only the true, constant bank-policy fact ("a request like this one runs against your bank's own policy") without asserting the caller claimed to be the bank, and documented the intentional constant-ness in decision 0015. Re-ran all suites green after the fix.

**Limitations / follow-up:** the live grounding path is cloud-gated (`DSN_WEB_VERIFICATION=grounded` + provisioned Vertex Gemini grounding) and is built + fake-tested only, never run live here; the `real` institution entry is a fictional `.example` placeholder until a deployment supplies a genuine `officialDomain`. Playwright UI/flow pass (Req C, authorized against a fake Gemini model) remains open.
