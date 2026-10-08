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
- **Status:** `in-progress` — plan written (`docs/superpowers/plans/2026-10-07-native-android-shell-sms-signal.md`); subagent-driven execution underway. Web half (Tasks 1–2) fully testable here; native half (Tasks 3–5) gated on DSN-021 local env (no Android SDK / RN on this machine 2026-10-08) and recorded blocked-not-inferred if unmet.

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

- [ ] RN Android shell builds a debug APK that boots to the DSN-018 web UI in a WebView; full journey runs unchanged inside it.
- [ ] `SmsSignalModule` reads an incoming SMS **only** after in-app consent **and** only while a Safe Session is open; receiver unregisters on session close/withdrawal; no SMS-history read; no background listening (respects PRD non-goal line 339).
- [ ] A real/emulated incoming SMS (`adb emu sms send`) appears in the Decision Map as evidence with provenance "Message received on device" + sender + timestamp, correlated with the active case.
- [ ] The SMS is treated as a *message claim*: any parsed payee/amount shows as proposed/claimed, never fills actually-paid fields, never auto-marks verified.
- [ ] Call audio remains simulated and labelled; the app makes no call-recording claim; 1930/cybercrime stay real and un-filed.
- [ ] Web-side listener is additive + feature-detected: `apps/web` serves the ally/reviewers unchanged in a plain browser; existing web suite (130) stays green; new listener unit test green; typecheck clean.
- [ ] No backend/API/contract/state-machine change; browser never calls Firestore/Gemini directly.
- [ ] Hygiene: `git diff --check` clean; no secrets/workplace identity/absolute JDK or SDK paths committed; personal no-reply commit identity.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded.

## Blocker or deferral

Not started. Resume condition: founder schedules the native track for the Cup.
Remaining risk until built: the "connect the dots" value is asserted, not
demonstrated live. Known environment risk: a full RN/Android APK build may hit the
same JDK/Android-SDK gaps recorded for the API emulator suite — flag unavailable
checks, never infer success.

## Handoff

Spec: `docs/superpowers/specs/2026-10-07-native-android-shell-sms-signal-design.md`;
decision: `project/decisions/0009-native-android-companion-shell.md`. Next step is
an implementation plan via the writing-plans skill, then claim. Reuse the DSN-018
web build in the WebView — do not rewrite the UI in native components.
