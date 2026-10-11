# DSN-025: Live call capture + transcription (labeled prototype path)

- **Scope:** core
- **Priority:** P1
- **Owner:** Orchestrator (subagent-driven implementer under integrator)
- **Branch/worktree:** `task/DSN-025-live-call-capture` (isolated worktree)
- **Owned paths:** `apps/android/**` (native mic-capture + on-device transcription module, consent/prototype-label UI), `apps/web/src/**` (transcript-segment bridge listener + prototype-capture label + controlled-transcript fallback). Session API `apps/api/src/session*` only if strictly needed — prefer the DSN-020 WebView bridge pattern (no downstream contract change). Serialized/not owned: no fact/policy/state-machine change.
- **Dependencies:** DSN-021 (native toolchain — done), DSN-024 (screening — done), DSN-023 (`callListening` gate — done). Pairs with DSN-024.
- **PRD references:** Part I — Decision 15; C2; Fixed scope (Interaction); live/simulated table; Prototype components (Interaction source); non-goals (consented, labeled, not covert)
- **Decision references:** 0009, 0010, **0012** (mic-during-speakerphone prototype capture; reconciles 0009's "never records" label)
- **Started:** 2026-10-12
- **Last updated:** 2026-10-12

## Outcome

The Android companion captures and transcribes a real device call (consented, user-configured per DSN-023) into the Safe Session, feeding the same segment pipeline the controlled transcript uses; the controlled transcript remains a reproducible fallback. The capture path is clearly labeled a prototype capability.

## Boundaries

- Included: capture + transcription on the controlled device via an OEM/accessibility/dialer-integrated path, segment emission into the existing session API, visible "prototype capture" + consent labeling, graceful fallback to the controlled transcript.
- Excluded: store-distributable call capture across arbitrary devices; covert/always-on recording; any change to downstream fact/policy semantics.

## Acceptance checks

- [~] A live call on the controlled device produces transcript segments that drive the Safe Session end to end. — **FOUNDER-ON-DEVICE PENDING** (per decision 0012). Pipeline code-complete and unit-tested web-side (segment bridge → `POST cases/:id/segments` → `facts/extract`); native capture written. Real speakerphone-call smoke is the founder's device step — `apps/android/MANUAL-E2E-TEST.md` Test D (D1–D12, incl. D9/D9b negatives).
- [x] Capture is gated on consent + the user's call-listening preference; the prototype-capture label is visible. — separate in-app consent + `RECORD_AUDIO`; DSN-023 `callListening`/`processingConsent` policy relay (`dsn:capture-policy`); session+foreground-scoped; stops on revoke/session-end/disallow with consent re-tap required; honest prototype-capture strip per decision 0012.
- [x] Controlled-transcript fallback still works unchanged (reproducible evaluation path intact). — `playScenario` untouched; capture-inactive label retained; D12 uses a fresh case to avoid the seg-id collision.
- [~] Native smoke verified on device/emulator; web + API suites green; no downstream contract change. — web 183/183 + typecheck clean + empty api/contracts diff all VERIFIED here; **native build + emulator/device smoke are founder-on-device-pending** (RN skeleton uncommitted by DSN-020 convention; not built in this environment).

## Verification evidence

- **Commits:** `a536f60` (web bridge + prototype label), `7cc859c` (native CallCapture module + RN bridge/labels + policy relay + docs), `7706ff0` (both blocking fixes: mic-stop on revoke/end + conditional on-device no-upload claim; +source-check, backoff cap, founder steps), `3a86d27` (consent-reset-on-disallow regression fix) on `task/DSN-025-live-call-capture`.
- **Integration commit:** `db6f4ba` — `git merge --no-ff` into local `main` (not pushed).
- **Commands and results:** `npm --workspace apps/web run test` → 183/183 (18 files; +21 over the 162 baseline). `npm run typecheck` → clean. API suite NOT run — no `apps/api`/`packages/contracts` change (empty diff confirmed).
- **Post-integration verification:** On merged `main` (`db6f4ba`): typecheck clean, web 183/183. api/contracts diff empty.
- **Independent review:** `dsn025-review` (fresh agent, read-only) — three rounds: initial NOT READY (2 blocking: mic-not-stopping on revoke/end; "audio not uploaded" overclaim) → fixed → NOT READY (1 new blocking: consent could resume without a fresh tap) → fixed. Final state: both/all blocking resolved; web pipeline, gating logic, honesty-label conditionals, source-hardening, and backoff verified here; native/consent code verified by inspection. Real-call + native build explicitly founder-on-device-pending per decision 0012.
- **Decision references:** 0009, 0010, **0012** (mic-during-speakerphone prototype capture; reconciles 0009's "never records" label).
- **Changed paths:** NEW `apps/web/src/liveTranscript.{ts,test.ts}`, `apps/android/src/CallCapture.ts`, `apps/android/android/app/src/main/java/com/dsncompanion/CallCaptureModule.kt`; edits to `apps/web/src/{App.tsx,App.test.tsx,SessionScreen.tsx,SessionScreen.test.tsx}`, `apps/android/{App.tsx,README.md,MANUAL-E2E-TEST.md}`, `SmsSignalPackage.kt`. No `apps/api`/`packages/contracts`.
- **Limitations or skipped checks:** Native Kotlin/RN NOT compiled or run in this environment (RN skeleton regenerated at bring-up per DSN-020). On-device STT availability varies by device/locale; the absolute "audio not uploaded" copy shows only when a true on-device recognizer is active, else softened copy. Deferred demo edges (NON-BLOCKING, see below).

## Founder-on-device verification (the one open acceptance item)

Run `apps/android/MANUAL-E2E-TEST.md` **Test D (D1–D12 + D9b)** on a physical Android device: consent + start capture + grant mic → put the call on **speakerphone** → say the scripted line → expect live transcript segments in the Session card then extracted facts in Decision; negatives: Stop processing while live → mic stops; new case → mic does NOT restart until re-consent (D9b); background → mic off; mic denied → not-capturing label; D11 manifest has no capture `<service>`/`<receiver>`; D12 fallback on a fresh case. Report back and I'll close this item.

## Deferred follow-ups (NON-BLOCKING demo edges)

- Nit 1: `segments` is local state, not reloaded from server — a mid-case WebView/page reload drops subsequent live segments (don't reload mid-call; noted in MANUAL-E2E).
- Nit 2: after a native engine error, the Stop button can remain though the mic is off.
- Nit 3: a WebView reload while the mic is live drops the web card's capture label until native re-emits status.

## Blocker or deferral

**DEFERRED — founder-on-device verification pending (2026-10-12).**
- **Rationale:** All orchestrator-closeable work is complete and integrated to local `main` (`db6f4ba`): web pipeline/bridge/gating/honesty-label logic unit-tested (183/183), typecheck clean, no downstream contract change, independent review passed after three fix rounds. The remaining acceptance item — a real speakerphone call producing live transcript segments end to end — and the native Kotlin/RN build cannot be executed in this environment and are explicitly assigned to the founder's device by decision 0012.
- **Remaining risk:** native code is verified by inspection only (uncompiled here); on-device STT availability and the mic/speakerphone capture quality are unproven until built on hardware.
- **Resume condition / owner:** Founder runs `apps/android/MANUAL-E2E-TEST.md` Test D (D1–D12 + D9b) on a physical Android device and reports results; the integrator then flips the two `[~]` acceptance items and moves the record to `done/`. Owner of that action: **Founder**.
- Status intentionally NOT `done` (mirrors the DSN-020 precedent: native runtime verified before done).

## Handoff

- **Next action:** Founder runs Test D on a physical Android device to close the live-call acceptance item. DSN-028 wires the authority-report fraud-list basis; DSN-026 (open-web verification) is next in the orchestration.
- **Unresolved issues:** None blocking; capture mechanism recorded in decision 0012.
