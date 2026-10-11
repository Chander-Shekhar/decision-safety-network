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
- **Last updated:** 2026-10-11
- **Status:** `done` — **fully verified, both halves.** Web half (Tasks 1–2) verified 2026-10-08 (146 web tests pass, typecheck exit 0). Native half (Tasks 3–5) was authored + reviewed then held **BLOCKED-NOT-INFERRED on DSN-021** (founder-authorized disposition 2026-10-08); DSN-021 is now `done`, and on **2026-10-11 the native track was built and smoke-tested on an emulator** (`dsn_api35`, API 35) — debug APK boots to the Web-View'd DSN web app; a consented, session- + foreground-scoped incoming SMS renders in the Decision view as a message *claim* (positive case), and an SMS received after Withdraw consent is not captured (negative case). All 5 plan tasks implemented, task-reviewed, committed; whole-branch final review (opus) returned APPROVE_WITH_FINDINGS (0 blocker, 0 major, 3 minor, 2 nit — all adjudicated ACCEPT). Merged to local `main` by the integrator; native verification + docs pushed to origin at `7cc4d34`.

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

- [x] **VERIFIED on emulator 2026-10-11:** RN Android shell builds a debug APK that boots to the DSN-018 web UI in a WebView; full journey runs unchanged inside it. — Scaffolded RN 0.87.1 (New Arch + Hermes), `./gradlew assembleDebug` → debug APK, `adb install` + launch on `dsn_api35`; WebView loaded `http://localhost:5173` (vite HMR connected) and the owner journey ran inside it (Create synthetic user → Save Safety Plan → Start controlled session → Decision view). Bring-up runbook in `apps/android/README.md`; follow-along in `apps/android/MANUAL-E2E-TEST.md`.
- [x] **VERIFIED on emulator 2026-10-11:** `SmsSignalModule` reads an incoming SMS **only** after in-app consent **and** only while a Safe Session is open; receiver unregisters on session close/withdrawal; no SMS-history read; no background listening (respects PRD non-goal line 339). — Code: programmatic `SMS_RECEIVED` receiver registered only between `startListening`/`stopListening`, gated by consent + open session **and** app foreground (AppState), unregistered on background/withdrawal/invalidate; no manifest `<receiver>`; no history read. Runtime negative case confirmed: after **Withdraw consent / end session**, an SMS the OS received was **not** captured — a subsequent session showed no "On-device signals" section.
- [x] **VERIFIED on emulator 2026-10-11:** a real/emulated incoming SMS (`adb emu sms send VM-DEMOBK …`) appears in the Decision view as evidence with provenance "Message received on device" + sender + timestamp, correlated with the active case. — Positive case: with a session open + foregrounded, the sent SMS rendered within ~1–2s as an "On-device signals" claim card (badge "Message received on device", `From VM-DEMOBK · <ISO-8601>`, body) above the honesty Callout. The web-side ingestion half remains additionally covered by unit tests (`App.test.tsx`, `DeviceSignalList.test.tsx`).
- [x] The SMS is treated as a *message claim*: any parsed payee/amount shows as proposed/claimed, never fills actually-paid fields, never auto-marks verified. — Verified web-side: `DeviceSignalList` renders a persistent Callout "A received message is a claim, not a verified fact or a completed payment" and a `Badge tone="info"`; tests assert no "paid"/"verified" text inside a signal item; the envelope parser strips any extra fields (e.g. `amountMinor`) so no payee/amount can reach actual-paid state.
- [x] Call audio remains simulated and labelled; the app makes no call-recording claim; 1930/cybercrime stay real and un-filed. — `apps/android/App.tsx` renders a persistent honesty label "Simulated call audio — this demo does not record calls."; no call-recording API is used or claimed; no change to the real-helpline routing.
- [x] Web-side listener is additive + feature-detected: `apps/web` serves the ally/reviewers unchanged in a plain browser; existing web suite stays green; new listener unit test green; typecheck clean. — Verified: `window.addEventListener('message', …)` added in a mount effect; envelope validation is the gate, so a plain browser's foreign messages are ignored (inert test asserts foreign + malformed are dropped). Full web suite **146 pass** (baseline 130 + new), `typecheck` exit 0 (2026-10-08).
- [x] No backend/API/contract/state-machine change; browser never calls Firestore/Gemini directly. — Verified: diff since `66b4c45` touches only `apps/android/**`, `apps/web/src/**`, `project/tasks/**`, `docs/demo-runbook.md` (and the git-ignored SDD ledger). No `apps/api`, no `packages/contracts`, no route/state-machine change.
- [x] Hygiene: `git diff --check` clean; no secrets/workplace identity/absolute JDK or SDK paths committed; personal no-reply commit identity. — Verified: `git diff --check 66b4c45 HEAD` clean; identifier scan (`sfdc|salesforce|chander|/Users/|repo.local|secret|password|apikey|jdk|/Library/Android`) clean on the native diff; JDK/SDK paths are shell-only exports, never committed; commits carry the no-reply co-author line.

Legend: `[x]` verified · (historical: `[~]` code-complete + reviewed, runtime verification blocked · `[ ]` blocked, not inferred — all cleared 2026-10-11).

Every applicable acceptance check is now marked complete and verified. The native build/APK/`adb` checks that were legitimately blocked on DSN-021 (and never inferred green) were run on an emulator on 2026-10-11 once DSN-021 was `done`; see the "Verification (2026-10-11, native track on emulator)" section below.

## Verification (2026-10-08, subagent-driven execution)

**Commands & results (this machine):**
- `npm --workspace apps/web run test` → **146 passed (15 files)**. Includes the new `deviceSignals.test.ts` (11), `DeviceSignalList.test.tsx`, and two `App.test.tsx` cases (ingestion into the Decision view; inert listener rejecting foreign + malformed envelopes).
- `npm --workspace apps/web run typecheck` → **exit 0**.
- `git diff --check 66b4c45 HEAD` → **clean**.
- Hygiene identifier scan on the native diff → **clean** (no workplace identity, no absolute JDK/SDK paths).

**Native steps (BLOCKED-NOT-INFERRED on DSN-021 as of 2026-10-08 — no RN CLI / Android SDK then) were run on 2026-10-11 once DSN-021 was `done`.** See the next section.

## Verification (2026-10-11, native track on emulator)

**Environment:** macOS arm64; emulator `dsn_api35` (android-35, google_apis, arm64-v8a). Per-terminal only (global `JAVA_HOME` untouched): main Gradle JVM on Homebrew `openjdk@21`; RN gradle-plugin Kotlin toolchain on JDK 17 (passed via `-Dorg.gradle.java.installations.paths`). `dev:api` (Firebase emulators) run under JDK 21. `adb reverse` for :5173 (web), :8787 (API), :9099 (Firebase Auth emulator — the WebView signs in against it directly), :8081 (Metro).

**Steps & results:**
- Scaffolded RN 0.87.1 outside the web workspaces, copied the committed DSN sources over the skeleton, registered `SmsSignalPackage()` in `MainApplication.kt`, added `RECEIVE_SMS` to the manifest (no `<receiver>`).
- `./gradlew assembleDebug` → **BUILD SUCCESSFUL** (debug APK ~126 MB). `adb install -r` + launch → app boots to the consent screen; WebView loads the DSN web app (vite HMR connected).
- **Positive smoke:** session open + foregrounded → `adb emu sms send VM-DEMOBK "Your account is blocked. Pay Rs 50000 to keep funds safe."` → rendered in the Decision view as an "On-device signals" **claim** card (badge "Message received on device", sender, ISO-8601 timestamp, body) above the honesty Callout. **PASS.**
- **Negative smoke:** **Withdraw consent / end session**, then `adb emu sms send …` → the OS received the SMS (system notification) but a subsequent fresh session showed **no** "On-device signals" section (`DeviceSignalList` returns null when empty) → not captured. **PASS.**

**Docs updated + pushed (`7cc4d34`):** `apps/android/README.md` (dropped the BLOCKED status; recorded the JDK split and the required `adb reverse` ports incl. :9099) and new `apps/android/MANUAL-E2E-TEST.md` (single follow-along manual mobile-view test). The generated RN skeleton remains **uncommitted by design** — regenerated at bring-up per the docs (founder decision 2026-10-11: keep generated artifacts out; only two one-line edits carry DSN logic and both are documented).

**Not committed (intentional):** the throwaway RN scaffold under `~/dsn-native-build/` and a local `node_modules/@react-native/gradle-plugin/settings.gradle.kts` foojay workaround (corporate-proxy only) — both documented, neither in the repo.

**Changed paths:** `apps/android/{App.tsx, src/SmsSignal.ts, README.md, android/app/src/main/java/com/dsncompanion/{SmsSignalModule.kt, SmsSignalPackage.kt}}`; `apps/web/src/{deviceSignals.ts, deviceSignals.test.ts, DeviceSignalList.tsx, DeviceSignalList.test.tsx, App.tsx, App.test.tsx}`; `docs/demo-runbook.md`; this task record. (SDD ledger under git-ignored `.superpowers/`.)

**Commits (branch `DSN-020`, base `66b4c45`):** `6643d7d` claim · `e469012`+`f5039fd` Task 1 (envelope parse/ingest + hardening) · `79145ab` Task 2 (DeviceSignalList + App listener) · `4075187` Task 2 inert-test strengthen · `8440a63` Tasks 3–5 native batch · `8d71bf0` native-review fixes (foreground-scope, multipart, API-safe time). Final whole-branch review + demo-runbook/task-record finalize commit pending.

## Blocker or deferral

**Resolved 2026-10-11.** The native build/APK/`adb` smoke were blocked on DSN-021 (Android SDK + JDK + RN CLI) as of 2026-10-08. DSN-021 is now `done`; the native track was built and smoke-tested on `dsn_api35` on 2026-10-11 (see "Verification (2026-10-11, native track on emulator)"). No open blockers. The "connect the dots" value is now live-demonstrated on a device for both the native delivery and web-ingestion halves.

## Handoff

Plan: `docs/superpowers/plans/2026-10-07-native-android-shell-sms-signal.md`; spec:
`docs/superpowers/specs/2026-10-07-native-android-shell-sms-signal-design.md`;
decision: `project/decisions/0009-native-android-companion-shell.md`; SDD ledger:
`.superpowers/sdd/2026-10-07-native-android-shell-sms-signal/progress.md`. Web half
is implemented + verified; native half is authored, reviewed, and (2026-10-11)
built + smoke-tested on an emulator — see `apps/android/MANUAL-E2E-TEST.md` to
reproduce. The WebView reuses the DSN-018 web build — the UI was not
rewritten in native components. Integrator ran the whole-branch final review and
merged to local `main` after the founder reviewed the consolidated report.
