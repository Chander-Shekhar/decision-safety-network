# DSN-021: Local environment setup for the native Android track (prerequisites)

- **Scope:** enabler / chore (developer environment) — not product-facing; no PRD behavior change
- **Priority:** P1 (blocks the native build + smoke steps of DSN-020; the web half of DSN-020 does not need it)
- **Owner:** Integrator (Claude Code) — running the install on this machine (2026-10-08)
- **Branch/worktree:** none required (local tooling chore; only this record changes, serialized on `main`). Machine-specific paths stay shell-only, never committed.
- **Owned paths:** none in product code. Documentation only. **No environment paths, SDK locations, or JDK paths are ever committed** — they are shell-only exports (hygiene rule).
- **Dependencies:** none to write it down; DSN-020 Tasks 3–5 (native build + smoke) depend on it being satisfied
- **Related:** DSN-020 (native companion), decision 0009, plan `docs/superpowers/plans/2026-10-07-native-android-shell-sms-signal.md`
- **Started:** 2026-10-08
- **Last updated:** 2026-10-08
- **Status:** `in-progress` — integrator installing the native toolchain on this machine (2026-10-08). Probe findings: Homebrew present; Node v24 (newer than RN's tested LTS — flagged); the only JDK found is a standalone **JDK 17** at a workplace path via a stale `JAVA_HOME` (not used/committed) — installing a clean Homebrew **openjdk@21** instead; no Android SDK / Android Studio / Watchman; arch **arm64** (Apple Silicon). Chosen compatible stack: Android Studio (latest stable, JBR 21) + openjdk@21 + Android SDK API 35 (build-tools 35, `arm64-v8a` image) with API 34 as a scaffold cushion + Watchman.

## Outcome

A documented, repeatable local setup so that DSN-020 Tasks 3–5 (React Native
Android shell, native `SmsSignalModule`, APK build + `adb` smoke test) can be
built and verified on this machine. Until it is satisfied, those native steps
are recorded as **blocked** (not inferred green) — the same honest ruling used
for the DSN-018 API emulator suite.

## Current machine state (2026-10-08)

- **JDK 21:** installed, but not on `JAVA_HOME`/`PATH` in every terminal — must be exported per-shell. **Never commit the absolute JDK path**; export it in the shell only.
- **Android SDK:** not installed.
- **React Native toolchain:** not installed.
- **Node + npm:** present (the `apps/web` workspace already builds/tests here).

## Prerequisites (what must be installed/configured)

1. **JDK 21 on PATH** (React Native 0.74+ requires JDK 17+; use the installed 21).
   - Per-shell export only, e.g. `export JAVA_HOME=$(/usr/libexec/java_home -v 21)` and `export PATH="$JAVA_HOME/bin:$PATH"`.
   - Verify: `java -version` → 21.
2. **Android SDK** (via Android Studio, or `cmdline-tools` only):
   - SDK Platform for a recent API level (e.g. **android-34**).
   - **platform-tools** (provides `adb`).
   - **build-tools** matching the chosen platform.
   - **Android Emulator** + a system image, OR a physical Android device with **USB debugging** enabled.
   - Exports (shell-only, never committed): `export ANDROID_HOME="$HOME/Library/Android/sdk"` (adjust to actual install), `export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"`.
   - Verify: `adb --version`; `sdkmanager --list` shows the installed platform.
3. **React Native CLI** (no global install needed; use `npx @react-native-community/cli@latest`). Confirm network access to the npm registry.
4. **Watchman** (recommended on macOS for RN file-watching): `brew install watchman`.
5. **Gradle:** no separate install — the RN project's Gradle wrapper (`./gradlew`) is used.
6. **Device/emulator reachability for the WebView dev URL:** the shell loads the `apps/web` dev server; expose it to the device with `adb reverse tcp:5173 tcp:5173` (or bundle the web build as assets — settled in the DSN-020 plan).
7. **Not needed:** CocoaPods / Xcode / iOS tooling — DSN-020 is Android-only by design.

## Acceptance checks

- [ ] `java -version` reports JDK 21 in the terminal used for the Android build.
- [ ] `adb --version` works; `adb devices` lists a running emulator or a connected device.
- [ ] `npx @react-native-community/cli --version` resolves (RN CLI reachable).
- [ ] A trivial `./gradlew tasks` (or RN doctor) run succeeds in a scaffolded RN project.
- [ ] `adb emu sms send <sender> "<text>"` is available against the running emulator (needed for the DSN-020 SMS smoke test).
- [ ] Hygiene: no SDK path, JDK path, or `ANDROID_HOME` value is committed to the repo; all are shell-only exports.

A machine that passes these checks unblocks DSN-020 Tasks 3–5. If it cannot be
satisfied (e.g. no capacity to install the Android SDK on this machine), DSN-020's
native build/smoke steps are recorded `blocked` with this task as the blocker and
owner, and the web half (DSN-020 Tasks 1–2) still ships and is fully verified.

## Blocker or deferral

Not started. Resume condition: before anyone runs DSN-020's native build on this
machine. Remaining risk until satisfied: the native "connect the dots" demo (APK +
live SMS) is implemented-but-unverified; the browser-side listener remains fully
tested regardless.

## Handoff

This is a reference/enabler record — satisfying it is a local operation, not a
code change. Keep all machine-specific paths in the shell, never in a committed
file. The authoritative build/smoke commands live in the DSN-020 plan and (once
written) `apps/android/README.md`.
