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
- **Status:** `done` — native toolchain installed and verified end-to-end on this machine (2026-10-08). Probe findings: Homebrew present; Node v24 (newer than RN's tested LTS — flagged); the only JDK found is a standalone **JDK 17** at a workplace path via a stale `JAVA_HOME` (not used/committed) — installing a clean Homebrew **openjdk@21** instead; no Android SDK / Android Studio / Watchman; arch **arm64** (Apple Silicon). Chosen compatible stack: Android Studio (latest stable, JBR 21) + openjdk@21 + Android SDK API 35 (build-tools 35, `arm64-v8a` image) with API 34 as a scaffold cushion + Watchman.

## Outcome

A documented, repeatable local setup so that DSN-020 Tasks 3–5 (React Native
Android shell, native `SmsSignalModule`, APK build + `adb` smoke test) can be
built and verified on this machine. Until it is satisfied, those native steps
are recorded as **blocked** (not inferred green) — the same honest ruling used
for the DSN-018 API emulator suite.

## Machine state BEFORE install (probe 2026-10-08)

- **JDK:** no JDK 21; the only JDK found was a standalone **JDK 17** at a workplace path via a stale `JAVA_HOME` — not used, not committed. (A clean Homebrew openjdk@21 was installed instead; see "Installed stack" below.)
- **Android SDK / Android Studio:** not installed.
- **React Native toolchain / Watchman:** not installed.
- **Node + npm:** present (Node v24; the `apps/web` workspace already builds/tests here).
- **Homebrew:** present (7.0.8). **Arch:** arm64 (Apple Silicon).

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

- [x] `java -version` reports JDK 21 in the terminal used for the Android build. — openjdk@21 **21.0.12.1** (Homebrew). (Standalone workplace JDK 17 left untouched/unused.)
- [x] `adb --version` works; `adb devices` lists a running emulator or a connected device. — `adb` **1.0.41** (platform-tools 37.0.1); AVD `dsn_api35` booted headless (boot_completed in ~16.5s) and `adb devices` listed `emulator-5554 device`.
- [x] `npx @react-native-community/cli --version` resolves (RN CLI reachable). — resolves to CLI **20.2.0** over the npm registry.
- [~] A trivial `./gradlew tasks` (or RN doctor) run succeeds in a scaffolded RN project. — **Deferred to the DSN-020 native bring-up** (needs a scaffolded RN project, which is DSN-020's step, not an env install). Every dependency this check exercises — JDK 21, Android SDK platform/build-tools, `adb`, emulator, Watchman, RN CLI — is independently verified above. RN `doctor` run standalone here only errors "not inside a React Native project" (expected).
- [x] `adb emu sms send <sender> "<text>"` is available against the running emulator (needed for the DSN-020 SMS smoke test). — Verified: `adb emu sms send VM-DEMOBK "…"` returned `OK` against the booted AVD, then clean `adb emu kill`.
- [x] Hygiene: no SDK path, JDK path, or `ANDROID_HOME` value is committed to the repo; all are shell-only exports. — This record documents the exports in portable `$HOME`/`$(brew --prefix …)` form only; no machine-specific absolute path is committed. Install produced no committed code.

Legend: `[x]` verified · `[~]` deferred to DSN-020 scaffold (all its dependencies verified).

A machine that passes these checks unblocks DSN-020 Tasks 3–5. If it cannot be
satisfied (e.g. no capacity to install the Android SDK on this machine), DSN-020's
native build/smoke steps are recorded `blocked` with this task as the blocker and
owner, and the web half (DSN-020 Tasks 1–2) still ships and is fully verified.

## Installed stack (2026-10-08, this machine, arm64)

| Component | Version | How |
|---|---|---|
| JDK | openjdk@21 **21.0.12.1** | `brew install openjdk@21` |
| Android Studio | latest stable (JBR 21) | `brew install --cask android-studio` |
| cmdline-tools | `latest` (also installed into the SDK root) | `brew install --cask android-commandlinetools` + `sdkmanager "cmdline-tools;latest"` |
| platform-tools (`adb`) | 37.0.1 | sdkmanager |
| Android Emulator | 37.2.12 | sdkmanager |
| SDK Platform | android-35 **and** android-34 | sdkmanager |
| build-tools | 35.0.0 **and** 34.0.0 | sdkmanager |
| system image | `system-images;android-35;google_apis;arm64-v8a` | sdkmanager |
| AVD | `dsn_api35` (API 35, google_apis, arm64) | avdmanager |
| Watchman | 2026.10.05.00 | `brew install watchman` |
| RN CLI | reachable (`@react-native-community/cli` 20.2.0) | `npx` (no global install) |

**Compatibility note:** API 35 is primary; API 34 is a cushion so an RN template pinned to either compileSdk builds without a second SDK trip. Pick the RN version at the DSN-020 scaffold to match (RN 0.76+ → compileSdk 35; RN 0.74/0.75 → 34). **Node is v24** (newer than RN's tested LTS 18/20/22) — if Metro/CLI misbehaves at scaffold, use an `nvm`-managed LTS; not an install problem.

## Shell exports (shell-only — never commit the resolved absolute paths)

Add to your shell profile or source per-terminal before an Android build (portable, no machine-specific literal):

```sh
export JAVA_HOME="$(brew --prefix openjdk@21)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

(`avdmanager` self-locates the SDK root via the SDK-local `cmdline-tools/latest`; the standalone Homebrew cmdline-tools alone infers the wrong root — the SDK-root copy is what makes `avdmanager`/`emulator` resolve the system image.)

## Result

**Setup complete and verified** (except the `[~]` check, which is a DSN-020 scaffold-time step). This unblocks DSN-020 Tasks 3–5: scaffold the RN project per `apps/android/README.md`, drop in the committed DSN sources, build the debug APK, `adb reverse tcp:5173 tcp:5173` + `tcp:8787`, boot `dsn_api35`, and run the `adb emu sms send` smoke — all now runnable on this machine.

## Handoff

This is a reference/enabler record — satisfying it was a local operation, not a
code change. All machine-specific paths stay in the shell, never in a committed
file (the exports above use portable `$HOME`/`$(brew --prefix …)` forms). The
authoritative build/smoke commands live in the DSN-020 plan and `apps/android/README.md`.
Resume DSN-020's native track from there whenever you want to demo the APK.
