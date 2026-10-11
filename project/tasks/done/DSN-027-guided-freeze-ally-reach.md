# DSN-027: Guided account freeze + ally WhatsApp/contact-caller

- **Scope:** core
- **Priority:** P1
- **Owner:** Orchestrator (subagent-driven implementer under integrator)
- **Branch/worktree:** `task/DSN-027-guided-freeze-ally-reach` (isolated worktree)
- **Owned paths:** `apps/api/src/{recovery,ally}*` (+ their tests), additive `packages/contracts/src/{recovery,ally}.ts`, `apps/web/src/{RecoveryScreen,AllyScreen,AllySharePreview}.tsx` (+ their tests). Serialized/not owned: no state-machine/policy/payment/screening/verification/plan change.
- **Dependencies:** DSN-022 (done); builds on existing `recovery`/`ally` modules.
- **PRD references:** Part I — Decisions 17 & 20; C8 (WhatsApp + contact caller); C10 (guided freeze); non-goal (no real freeze); gates (minimum ally packet, revocation)
- **Decision references:** 0010
- **Started:** 2026-10-12
- **Last updated:** 2026-10-12

## Outcome

Recovery offers guided protection for the affected account — bank helpline number plus a prepared, case-filled "what to say" script — with no real freeze. The Safety Ally can be reached via a WhatsApp summary (deep link / share) and has an "contact the caller on the user's behalf" action, while still unable to control funds or certify the caller.

## Boundaries

- Included: guided-freeze card (affected account only, helpline + script), WhatsApp summary deep-link for the ally, ally→caller contact action, preserved minimum-packet + revocation semantics.
- Excluded: any real bank freeze/integration; ally fund control or caller certification; auto-sending without the user's action.

## Acceptance checks

- [x] Recovery shows a guided-freeze card scoped to the affected account with a case-filled script; no real freeze is performed or implied. — `GuidedFreeze` carries `guided:true`, `realFreeze:false`, `scope:'affected-account-only'`; `buildGuidedFreeze` (`recovery-freeze.ts`) is pure (no I/O, writes nothing, calls no bank); card copy reads "Guided steps, not a real freeze". Proof: `recovery-freeze.test.ts` asserts `realFreeze:false`, affected-account-only scope, the script never asserts "frozen", and no `frozen`/`accountFrozen` field is written to the case; `RecoveryScreen.freeze.test.tsx` asserts the "not a real freeze" copy.
- [x] The ally can be reached via a WhatsApp summary containing only the minimum packet; the ally→caller contact action is available. — `GET /api/v1/cases/:id/ally-whatsapp-summary?allyUid=` (owner) and `GET /api/v1/ally/cases/:id/whatsapp-summary` (ally) build text from `readAllyPacket` only; `POST /api/v1/ally/cases/:id/contact-caller` returns an advisory `AllyCallerContact` script. Proof: `ally-reach.test.ts` "WhatsApp summary carries ONLY the minimum packet" (body omits hidden transcript + unselected evidence); contact-caller returns a script and leaves `paymentState`/`phase` unchanged.
- [x] Ally still cannot fetch the full transcript/unshared evidence or control funds/certify (direct API test); revocation removes access on the next request. — Proof: `ally-reach.test.ts` "LEAST PRIVILEGE (direct API)" (403 on unshared evidence; 400 on `certify-caller`/`approve-payment`/`move-funds` kinds; `GET /cases/:id` as ally 403/404) and "REVOCATION (direct API)" (after DELETE revoke, next packet/ally-summary/owner-summary/contact-caller all 403, contact-caller body leaks no case text, `allyResponses` has 0 docs). Both new ally paths call `readAllyPacket`, which rechecks relationship/consent/grant-not-revoked/expiry on every request.
- [x] API + web suites green; typecheck clean. — see below.

## Verification evidence

- **Commits (branch `task/DSN-027-guided-freeze-ally-reach`):** `344f41b` (API + additive contracts + API tests), `d145481` (web screens + tests).
- **Integration commit:** `f3c0c6d` — `git merge --no-ff` into local `main` (not pushed). Integrator follow-up `8a5a124` wires `App.tsx` (owner `AllySharePreview` offers the WhatsApp summary only after a grant exists; ally `AllyScreen` gets the contact-caller action and flips to `revoked` on a 403). Guided-freeze card needed no wiring (`RecoveryScreen` renders `state.guidedFreeze`).
- **Commands and results (on merged `main` after the App wiring):** `npm run typecheck` → clean (contracts, api, web). `npm --workspace apps/web run test` → 193/193 (21 files; +5 over 188). API suite under emulators → 394/394 (20 files; +8 over 386), exit 0.
- **Post-integration verification:** re-ran all three on merged `main` after the wiring commit — typecheck clean, web 193/193, API 394/394.
- **Independent review:** `dsn027-review` (fresh agent, read-only; ran suites on a worktree checkout) — verdict **READY, no blocking defects**. Confirmed all 5 invariants PASS (no real freeze; ally least-privilege; real revocation; no auto-send — server returns `https://wa.me/?text=` with no `to`, link is a human-tapped `<a target=_blank rel=noopener>`; helpline from a fixed registry-tied constant, routes accept no phone input), additive-only contracts, and that `App.tsx`/state-machine/policy/payment/screening/verification are untouched by the branch.
- **Decision references:** 0010.
- **Changed paths:** NEW `apps/api/src/{recovery-freeze,ally-reach}.ts`, `apps/api/test/{recovery-freeze,ally-reach}.test.ts`, `apps/web/src/{RecoveryScreen.freeze,AllyReach}.test.tsx`; EDITED `apps/api/src/{recovery,recovery-routes,ally,ally-routes}.ts`, `apps/web/src/{RecoveryScreen,AllyScreen,AllySharePreview}.tsx`, `packages/contracts/src/{recovery,ally}.ts`, and (integrator) `apps/web/src/App.tsx`.
- **Limitations or skipped checks:** no browser smoke (component + API tests only). Helpline literal lives in `recovery-freeze.ts` (owned-path reason), tied to `DEMO_BANK_REGISTRY.version` — honest provenance, but not sourced from the registry data file (cleanup noted below). Non-blocking nits below.

## Deferred follow-ups (NON-BLOCKING, from independent review)

- Nit 1 (honesty edge): the caller's `centralClaim` is echoed into the guided-freeze "what to say" script via `plain()` (strips control chars only). A caller claim literally containing "frozen" would appear in the script as a quoted caller claim (never as an app assertion that the account was frozen). Consider labeling the quoted-claim line or widening the negative check.
- Nit 2 (test strength): the least-privilege test's payment-route assertion hits `/api/v1/ally/cases/:id/payment/continue`, which does not exist, so its 404 proves nothing. The real owner-scoped routes (`/payment/draft|submit|recheck`, `/actions/*`) deny the ally by construction (`case-store.ts` ownerUid checks) but no test proves it. Strengthen the assertion to hit a real route.
- Nit 3 (test strength): the helpline-injection test puts the number in `claimedIdentity`, which the script never reads; a number in `centralClaim` would reach the script text (never the helpline field). Move the injected number into `centralClaim` for a meaningful assertion.
- Cleanup: fold `DEMO_BANK_HELPLINE_NUMBER` into `demo-bank-registry.ts` so the registry is the single source (was outside the implementer's owned paths).

## Blocker or deferral

Not applicable — integrated and verified.

## Handoff

- **Next action:** DSN-028 (user-submitted pre-filled 1930/NCRP report) is next; it also wires the DSN-024 `authority-report` fraud-list basis. DSN-029 (dashboard) stays deferred until the Core Cup-ready gate passes.
- **Unresolved issues:** None blocking. Four non-blocking follow-ups recorded above.
