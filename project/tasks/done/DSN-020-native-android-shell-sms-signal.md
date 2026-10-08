# DSN-020: Native Android companion shell (React Native + WebView) with a consented on-device SMS signal

- **Scope:** core (native surface + one on-device signal) — founder-authorized scope addition 2026-10-07
- **Priority:** P1 (Cup-impact: live "the phone connected the dots" demo moment)
- **Owner:** Integrator (Claude Code, subagent-driven execution)
- **Branch/worktree:** `DSN-020-native-android-shell-sms-signal` in `.worktrees/DSN-020`
- **Owned paths:** new `apps/android/**` (React Native shell + native `SmsSignalModule`); additive, feature-detected SMS listener in `apps/web/src/**`; serialized modify: root `package.json`/lockfile only if the RN track is added to the workspace; `docs/demo-runbook.md`; decision 0009
- **Dependencies:** DSN-018 (styled web journey — reused 100% via WebView); DSN-014 (local e2e harness / hosted web surface the WebView loads)
- **PRD references:** Initial surface (line 10), Deployment (108), Prototype components 1–2 (250–251), Explicit Cup non-goals (339–340), near-term companion note (763)
- **Decision references:** 0009 (native Android companion shell), 0008 (styling stack), 0001 (architecture)
- **Started:** 2026-10-08
- **Last updated:** 2026-10-08
- **Status:** `done` (web half) with the native track **explicitly BLOCKED on DSN-021** — founder-authorized this disposition 2026-10-08 after reviewing the consolidated report. All 5 plan tasks implemented, task-reviewed, and committed; whole-branch final review (opus) returned APPROVE_WITH_FINDINGS (0 blocker, 0 major, 3 minor, 2 nit — all adjudicated ACCEPT, none load-bearing). Web half (Tasks 1–2) verified here (146 web tests pass, typecheck exit 0). Native half (Tasks 3–5) source authored + reviewed; build/APK/`adb` smoke are **BLOCKED-NOT-INFERRED on DSN-021** (no Android SDK / RN CLI 2026-10-08) — never reported green; resume via `apps/android/README.md` once DSN-021 prerequisites are met. Merged to local `main` by the integrator.

## Outcome

A sideloadable **debug Android APK**: a React Native shell hosting the DSN-018 web
UI in a full-screen WebView, plus one **real, consented, session-scoped** on-device
signal — an incoming SMS that auto-flows into the active Safe Session's Decision
Map as a *message claim* (provenance + timestamp), demonstrating "connect the dots
across phone signals" live, with call audio still simulated and labelled and no
overclaim of call-audio capture.

## Boundaries

- **Included:** RN Android app + WebView host of the existing web build; native
  Kotlin `SmsSignalModule` (`SMS_RECEIVED` receiver) gated by explicit consent and
  active only during an open Safe Session; the RN→WebView bridge
  (`{ type:'dsn:sms-signal', from, body, receivedAt }`); the additive,
  feature-detected web-side listener ingesting the SMS as a case signal; honesty
  labels; a debug APK; web-side unit test + native smoke test.
- **Excluded:** iOS; call-audio capture; more than the one SMS signal; Play Store
  release/signing; background/always-on listening; reading SMS history; any
  API/route/contract/state-machine change; push notifications; any change to
  mandated safety copy (preserve verbatim). All existing Cup non-goals hold.

## Acceptance checks

- [ ] **BLOCKED on DSN-021 (not inferred):** RN Android shell builds a debug APK that boots to the DSN-018 web UI in a WebView; full journey runs unchanged inside it. — WebView host authored (`apps/android/App.tsx`, `source={{ uri: 'http://localhost:5173' }}`); no RN CLI / Android SDK here, so no `react-native init` scaffold, `assembleDebug`, or boot smoke was run. Bring-up runbook in `apps/android/README.md`.
- [~] `SmsSignalModule` reads an incoming SMS **only** after in-app consent **and** only while a Safe Session is open; receiver unregisters on session close/withdrawal; no SMS-history read; no background listening (respects PRD non-goal line 339). — **Code-complete and reviewed:** programmatic `SMS_RECEIVED` receiver registered only between `startListening`/`stopListening`, gated by consent + open session **and** app foreground (AppState), unregistered on background/withdrawal/invalidate; no manifest `<receiver>`; no history read. **Runtime verification BLOCKED on DSN-021** (needs a device/emulator).
- [ ] **BLOCKED on DSN-021 (not inferred):** a real/emulated incoming SMS (`adb emu sms send`) appears in the Decision Map as evidence with provenance "Message received on device" + sender + timestamp, correlated with the active case. — The **web-side half** (ingesting a posted `dsn:sms-signal` envelope and rendering it in the Decision view with sender + ISO timestamp) IS verified by unit test (`App.test.tsx` ingestion test, `DeviceSignalList.test.tsx`). The **native→device delivery** half is BLOCKED (emulator smoke).
- [x] The SMS is treated as a *message claim*: any parsed payee/amount shows as proposed/claimed, never fills actually-paid fields, never auto-marks verified. — Verified web-side: `DeviceSignalList` renders a persistent Callout "A received message is a claim, not a verified fact or a completed payment" and a `Badge tone="info"`; tests assert no "paid"/"verified" text inside a signal item; the envelope parser strips any extra fields (e.g. `amountMinor`) so no payee/amount can reach actual-paid state.
- [x] Call audio remains simulated and labelled; the app makes no call-recording claim; 1930/cybercrime stay real and un-filed. — `apps/android/App.tsx` renders a persistent honesty label "Simulated call audio — this demo does not record calls."; no call-recording API is used or claimed; no change to the real-helpline routing.
- [x] Web-side listener is additive + feature-detected: `apps/web` serves the ally/reviewers unchanged in a plain browser; existing web suite stays green; new listener unit test green; typecheck clean. — Verified: `window.addEventListener('message', …)` added in a mount effect; envelope validation is the gate, so a plain browser's foreign messages are ignored (inert test asserts foreign + malformed are dropped). Full web suite **146 pass** (baseline 130 + new), `typecheck` exit 0 (2026-10-08).
- [x] No backend/API/contract/state-machine change; browser never calls Firestore/Gemini directly. — Verified: diff since `66b4c45` touches only `apps/android/**`, `apps/web/src/**`, `project/tasks/**`, `docs/demo-runbook.md` (and the git-ignored SDD ledger). No `apps/api`, no `packages/contracts`, no route/state-machine change.
- [x] Hygiene: `git diff --check` clean; no secrets/workplace identity/absolute JDK or SDK paths committed; personal no-reply commit identity. — Verified: `git diff --check 66b4c45 HEAD` clean; identifier scan (`sfdc|salesforce|chander|/Users/|repo.local|secret|password|apikey|jdk|/Library/Android`) clean on the native diff; JDK/SDK paths are shell-only exports, never committed; commits carry the no-reply co-author line.

Legend: `[x]` verified here · `[~]` code-complete + reviewed, runtime verification blocked · `[ ]` blocked (not inferred).

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded. The native build/APK/`adb` checks above remain legitimately blocked on DSN-021 and are **not** inferred green; the founder decides whether to hold the task open for the native track or accept the web-verified half with the native half explicitly blocked.

## Verification (2026-10-08, subagent-driven execution)

**Commands & results (this machine):**
- `npm --workspace apps/web run test` → **146 passed (15 files)**. Includes the new `deviceSignals.test.ts` (11), `DeviceSignalList.test.tsx`, and two `App.test.tsx` cases (ingestion into the Decision view; inert listener rejecting foreign + malformed envelopes).
- `npm --workspace apps/web run typecheck` → **exit 0**.
- `git diff --check 66b4c45 HEAD` → **clean**.
- Hygiene identifier scan on the native diff → **clean** (no workplace identity, no absolute JDK/SDK paths).

**Not run (BLOCKED-NOT-INFERRED on DSN-021 — no RN CLI / Android SDK here):** `react-native init` scaffold, `./gradlew assembleDebug`, `adb install`, and `adb emu sms send` e2e smoke. These are documented in `apps/android/README.md` and must be run on a machine meeting DSN-021 prerequisites. Not reported green.

**Changed paths:** `apps/android/{App.tsx, src/SmsSignal.ts, README.md, android/app/src/main/java/com/dsncompanion/{SmsSignalModule.kt, SmsSignalPackage.kt}}`; `apps/web/src/{deviceSignals.ts, deviceSignals.test.ts, DeviceSignalList.tsx, DeviceSignalList.test.tsx, App.tsx, App.test.tsx}`; `docs/demo-runbook.md`; this task record. (SDD ledger under git-ignored `.superpowers/`.)

**Commits (branch `DSN-020`, base `66b4c45`):** `6643d7d` claim · `e469012`+`f5039fd` Task 1 (envelope parse/ingest + hardening) · `79145ab` Task 2 (DeviceSignalList + App listener) · `4075187` Task 2 inert-test strengthen · `8440a63` Tasks 3–5 native batch · `8d71bf0` native-review fixes (foreground-scope, multipart, API-safe time). Final whole-branch review + demo-runbook/task-record finalize commit pending.

## Blocker or deferral

Native build/APK/`adb` smoke are **blocked on DSN-021** (local env: Android SDK + JDK 21 on PATH + RN CLI — absent on this machine 2026-10-08). Evidence: the native source compiles only inside a scaffolded RN project that cannot be generated here. Next action: satisfy DSN-021 prerequisites, then run the `apps/android/README.md` bring-up + smoke. Owner of that action: founder (schedules the native track / provides the local env). Remaining risk until built: the "connect the dots" value is live-demonstrated only on the web-ingestion half here; the native delivery half is asserted + reviewed, not yet run on a device.

## Handoff

Plan: `docs/superpowers/plans/2026-10-07-native-android-shell-sms-signal.md`; spec:
`docs/superpowers/specs/2026-10-07-native-android-shell-sms-signal-design.md`;
decision: `project/decisions/0009-native-android-companion-shell.md`; SDD ledger:
`.superpowers/sdd/2026-10-07-native-android-shell-sms-signal/progress.md`. Web half
is implemented + verified; native half is authored + reviewed with build/smoke
blocked on DSN-021. The WebView reuses the DSN-018 web build — the UI was not
rewritten in native components. Integrator runs the whole-branch final review and
merges to local `main` only after the founder reviews the consolidated report.
