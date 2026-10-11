# DSN-026: Open-web claim verification evidence

- **Scope:** core
- **Priority:** P1
- **Owner:** Orchestrator (subagent-driven implementer under integrator)
- **Branch/worktree:** `task/DSN-026-open-web-claim-verification` (isolated worktree)
- **Owned paths:** `apps/api/src/verification*` (+ `apps/api/test/**` for it), additive `packages/contracts/src/verification` or `facts`/`session` evidence field (additive only), `apps/web/src/{VerifyPanel.tsx,DecisionMap.tsx}` (+ their tests). Serialized/not owned: no state-machine/policy change, no screening/recovery/ally/plan modules.
- **Dependencies:** DSN-022 (done). Builds on the existing `apps/api/src/verification.ts`/`verification-routes.ts`.
- **PRD references:** Part I — Decision 19; C7 (web lookups as labeled untrusted evidence); Responsibility boundary; Trust gate (actionable route still from curated records)
- **Decision references:** 0010; **0013** (swappable web-verification adapter; deterministic curated default + grounding seam); untrusted-evidence discipline per 0011
- **Started:** 2026-10-12
- **Last updated:** 2026-10-12

## Outcome

The verification adapter performs grounded open-web lookups of the caller's claimed identity and the institution's official contact numbers, surfaced in Verify/Decision Map as labeled, untrusted supporting evidence that corroborates or contradicts the claim (e.g. "this number does not match HDFC's registered pattern") — never the actionable official route and never self-certifying.

## Boundaries

- Included: grounded web lookup (via the Google AI grounding path or a curated adapter), labeled-evidence contract field, Verify/Decision Map presentation, prompt-injection resistance tests.
- Excluded: using web results as the official verification route; auto-certifying a caller; replacing the versioned Demo Bank registry.

## Acceptance checks

- [x] A claimed identity with a mismatching number shows a labeled contradiction; a plausible match shows labeled corroboration. — stance logic `web-verification.ts:61-72` (`mismatch`→`contradicts`, `matches-pattern`→`corroborates`); UI renders text stance labels ("Contradicts public listing" / "Fits public listing" / "No public match") + glyph (`aria-hidden`), under a "Public web evidence · not verified" header (`VerifyPanel.tsx` `WebEvidenceList`), shown under the claimed-identity fact in `DecisionMap`. API test `web-verification.test.ts:49-66`; component test `WebEvidence.test.tsx`.
- [x] Web/caller-ID evidence is server-labeled untrusted and cannot become the official route or certify the caller (direct API test). — literal types `trust:'untrusted'`/`officialRoute:null`/`certifiesCaller:false`/`simulated:true` in the contract and set server-side (`web-verification.ts:82-87`); `BodySchema` has no field to set them. Direct API test (`web-verification.test.ts:68-100`) sends hostile `trust`/`officialRoute`/`certifiesCaller`/`stance` in the body and asserts untrusted/null/false, case version/phase/event-count unchanged, registry still equals `DEMO_BANK_REGISTRY`, and `/verify` still 400s on a smuggled `officialRoute`.
- [x] Injection content embedded in web results cannot alter policy or supply an official contact. — `sanitizeWebLookup` (`web-verification.ts:32-40`) whitelists only a curated `institutionKey` + closed `numberMatch` enum; all other provider fields discarded; all output text is server templates + curated display name. Injection tests (`web-verification.test.ts`, "web-verification prompt-injection resistance (injection set)"): hostile adapter returning attacker number / "IGNORE PREVIOUS INSTRUCTIONS" / fake certification / extra fields → none appear in the response, case state unchanged; injected `claimedIdentity` is not echoed/stored and cannot flip the stance. (Folds into the DSN-015 eval injection set when that lands — DSN-015 still backlog.)
- [x] API + web suites green; typecheck clean. — see below.

## Verification evidence

- **Commits (branch `task/DSN-026-open-web-claim-verification`):** `8198cd3` (adapter + untrusted-evidence API/contract + tests), `a65eda7` (VerifyPanel/DecisionMap untrusted-evidence UI + tests).
- **Integration commit:** `3f47fa4` — `git merge --no-ff` into local `main` (not pushed). Integrator follow-up `f0a2756` wires `App.tsx` (loads `GET cases/:id/web-verification` on case open, adds the public-listing check control in the Decision step, passes `webEvidence` to `DecisionMap` and `VerifyPanel`).
- **Commands and results (on merged `main`, `f0a2756`):** `npm run typecheck` → clean (contracts, api, web). `npm --workspace apps/web run test` → 188/188 (19 files; +5 over the 183 baseline). API suite under emulators (`emulators:exec … auth,firestore`) → 386/386 (18 files; +7 over the 379 baseline), script exited 0.
- **Post-integration verification:** re-ran all three on merged `main` after the `App.tsx` wiring commit — typecheck clean, web 188/188, API 386/386.
- **Independent review:** `dsn026-review` (fresh agent, read-only; ran the suites on a `git archive` export) — verdict **READY, no blocking defects**. Confirmed all four criteria PASS, the sealed Demo Bank path intact (no change to `verification.ts`/`server.ts`/`app.ts`/`demo-bank-registry.ts`; only additive mount in `verification-routes.ts`), owner-checked routes (401/403/404), additive-only contract, and retention sweep covers the new `webVerificationEvidence` subcollection.
- **Decision references:** 0010; **0013** (adapter mechanism); untrusted-evidence discipline per 0011.
- **Changed paths:** NEW `packages/contracts/src/web-verification.ts`, `apps/api/src/web-verification{,-adapter,-routes}.ts`, `apps/api/test/web-verification.test.ts`, `apps/web/src/WebEvidence.test.tsx`; EDITED `apps/api/src/verification-routes.ts` (+~7 lines, mount only), `apps/web/src/{VerifyPanel,DecisionMap,App}.tsx`. Sealed `apps/api/src/verification.ts`, `server.ts`, `app.ts`, `demo-bank-registry.ts` untouched.
- **Limitations or skipped checks:** curated institution table is synthetic (two fictional institutions); live Gemini-grounding path is a documented seam, not enabled (decision 0013). Injection tests live in the API test file pending the DSN-015 eval injection set.

## Blocker or deferral

Not applicable — integrated and verified.

## Handoff

- **Next action:** DSN-027 (guided freeze + ally WhatsApp/contact-caller) is next in the orchestration. DSN-028 wires the DSN-024 `authority-report` fraud-list basis.
- **Unresolved issues:** None. Grounding mechanism resolved in decision 0013 (swappable adapter; deterministic curated default shipped, live grounding is an injectable seam).
