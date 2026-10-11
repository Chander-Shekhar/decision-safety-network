# DSN-024: Pre-pickup caller screening (caller-ID + private fraud list)

- **Scope:** core
- **Priority:** P1
- **Owner:** Orchestrator (subagent-driven implementer under integrator)
- **Branch/worktree:** `task/DSN-024-pre-pickup-caller-screening` (isolated worktree)
- **Owned paths:** NEW `apps/api/src/screening*` + `apps/api/src/fraud-list*` (+ matching `apps/api/test/**`), NEW `packages/contracts/src/screening.ts` (and additive edits to `fraud`/`case` contracts if needed), NEW `apps/web/src/` screening screen + edits to incoming-call/session entry. Serialized/not owned: do not restructure plan/recovery/ally/payment/verification semantics.
- **Dependencies:** DSN-022, DSN-023 (plan `callListening` readable via `getPlan`) — both integrated. Pairs with DSN-025.
- **PRD references:** Part I — C2 (pre-pickup screening), C13 (private confirmed-fraud list); External-signals scope row; Responsibility boundary (untrusted signals); non-goal (no public blacklist)
- **Decision references:** 0010
- **Started:** 2026-10-11
- **Last updated:** 2026-10-11

## Outcome

Before pickup, an incoming call shows a screening verdict: a (simulated, swappable-adapter) third-party caller-ID/reputation signal plus a check against the private confirmed-fraud list, with a calm "unverified caller" / "previously reported" warning. The private list is written only on user fraud-confirmation or authority report (C13).

## Boundaries

- Included: caller-ID adapter interface + simulated impl, private fraud-list store + read/write API, pre-pickup screen UI, calm warning copy, list-population hook from case resolution/report.
- Excluded: public blacklist, criminal attribution, any cross-user exposure beyond "warn the recipient"; real Truecaller credentials (adapter is simulated for the Cup).

## Acceptance checks

- [x] An incoming call from an unverified/previously-reported number shows the warning before pickup; a clean number shows nothing. — `POST /screening/check` → `previously-reported`/`unverified`/`none`; `ScreeningScreen` renders a callout only when `warn`.
- [x] Confirming a case as fraud (or reporting it) adds the identifier to the private list; a later matching call warns. — `POST /cases/:id/fraud-confirmation` (only writer) → `addConfirmedFraud`; match works across number formats. (`authority-report` basis is API-ready; its UI wiring lands with DSN-028 — see follow-ups.)
- [x] Caller-ID/web signals are stored/labeled as untrusted evidence and cannot become the official route or certify a caller (direct API test). — `sanitizeSignal` strips provider text; server sets `trust:'untrusted'`, `officialRoute:null`, `certifiesCaller:false`; client-sent trust/route/addToFraudList ignored; hostile-adapter + injection tests cover it.
- [x] API + web suites green; typecheck clean. — see evidence below.

## Verification evidence

- **Commits:** `6affe1a` (screening API + private fraud list + simulated caller-ID adapter), `68875ff` (incoming-call screen + fraud-confirmation panel), `412fb66` (merge main / decision 0011), `8e39c72` (HMAC-keyed ids + owner forget routes + retention test) on `task/DSN-024-pre-pickup-caller-screening`.
- **Integration commit:** `99e8684` — `git merge --no-ff` into local `main` (not pushed).
- **Commands and results:** `npm run typecheck` clean (0 `error TS`). `npm --workspace apps/web run test` → 162/162 (17 files). API suite via emulators (JDK 21) → 379/379 (17 files; +18 over the 361 baseline).
- **Post-integration verification:** All three rerun on merged `main` (`99e8684`): typecheck clean, web 162/162, API 379/379.
- **Independent review:** `dsn024-review` (fresh agent, read-only) — initial verdict NOT READY (2 blocking privacy items on the fraud-list store); after fixes, re-review verdict READY TO INTEGRATE. Confirmed: HMAC-keyed non-reversible ids (dev-only default, no real secret committed); owner forget routes with sound uid-scoped isolation; untrusted-evidence enforcement; cross-user isolation; retention test proves `screeningSignals` purged on case delete while the fraud-list entry deliberately survives (decision 0011).
- **Decision references:** 0010 (C13 scope), **0011** (private fraud-list privacy, HMAC id, durable-by-design + owner forget path).
- **Changed paths:** NEW `apps/api/src/{screening,screening-adapter,screening-routes,fraud-list}.ts`, `apps/api/test/screening.test.ts`; NEW `packages/contracts/src/screening.ts`; NEW `apps/web/src/ScreeningScreen.{tsx,test.tsx}`; edits to `apps/web/src/{App.tsx,HomeScreen.tsx}` and a 2-line route mount in `apps/api/src/server.ts`.
- **Limitations or skipped checks:** No App-level integration test for the Home→incoming-call wiring (component tests only). Pre-pickup web flow has no case yet, so the case-scoped `screeningSignals` path is API-tested only.

## Deferred follow-ups (non-blocking)

- **Badge / founder decision (interactive polish pass):** a *warning* verdict shows a second "Simulated caller-ID lookup" label beside the single header disclosure. Reviewer flagged this against the one-consolidated-disclosure preference. Deferred to the founder's interactive UI pass — drop the badge or accept it.
- **HMAC fail-closed (hardening):** `FRAUD_LIST_HMAC_SECRET` falls back to a plainly-marked dev-only constant when unset; harmless for this synthetic/no-deploy demo, but a real prod deploy should fail closed when the secret is unset under `NODE_ENV=production`.
- **`authority-report` UI wiring:** API accepts the basis; the panel sends only `user-confirmed`. Wire the authority-report path in DSN-028.
- Minor: `addConfirmedFraud` guards owned-case but not scam-state; `clearFraudList` deletes docs one-by-one (fine at demo scale).

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Integrated and done. DSN-025 (live capture) pairs with this; DSN-028 wires the authority-report fraud-list basis.
- **Unresolved issues:** None blocking; see deferred follow-ups above.
