# DSN companion - native Android shell (DSN-020)

**Android-only, sideloaded DEBUG/demo build.** Not a Play Store release. Hosts the DSN web app in a WebView and
forwards consented, session-scoped incoming SMS to it as a message *claim*. Synthetic demo data only.

## Status: BUILT AND SMOKE-TESTED on an emulator (DSN-021 prerequisites met)

The DSN companion has been scaffolded (React Native 0.87.1, New Architecture + Hermes), built to a debug APK,
installed on an Android 15 (API 35) emulator, and smoke-tested end to end. Both cases pass:

- **Positive** — an SMS received during an open, foregrounded, consented session renders in the Decision view's
  "On-device signals" as a message *claim* (sender, timestamp, and the honesty line "a received message is a claim,
  not a verified fact or a completed payment").
- **Negative** — after **Withdraw consent / end session**, the receiver is unregistered; an SMS delivered to the
  device while consent is withdrawn is **not** captured and does not appear in a later session.

Only the DSN-specific sources are committed; the generated React Native project skeleton (gradle wrapper,
`settings.gradle`, `MainActivity`, `MainApplication`, `build.gradle`) is produced at bring-up and is **not**
checked in. Regenerate it with the steps below.

Authored here:
- `App.tsx` - WebView host, consent gate, SMS-to-WebView bridge, persistent honesty label
- `src/SmsSignal.ts` - JS wrapper over the native module
- `android/app/src/main/java/com/dsncompanion/SmsSignalModule.kt`, `SmsSignalPackage.kt`

Signatures marked `verify against RN <version> on scaffold` in the sources must be checked against the scaffolded RN version.

## Shell environment (local testing — export per new terminal)

The toolchain is installed (DSN-021). `ANDROID_HOME` is persisted in the shell profile
(`~/.zshrc`); the global `JAVA_HOME` is left as-is. Export the rest **per terminal**
(portable form; never commit a resolved absolute path):

```sh
# ANDROID_HOME is already in ~/.zshrc.
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
# The main Gradle JVM AND the Firebase emulators (dev:api) require JDK 21 — override per terminal:
export JAVA_HOME="$(brew --prefix openjdk@21)"
```

**JDK split (verified during bring-up):** Gradle 9's strict POM parser plus the toolchain
resolution path mean the **main Gradle JVM must be JDK 21**, while the React Native gradle-plugin
compiles its Kotlin against a **JDK 17** toolchain. If Gradle cannot auto-detect a JDK 17, pass
`-Dorg.gradle.java.installations.paths="<path-to-your-jdk17-home>"` on the build. `dev:api`
(Firebase emulators) also needs JDK 21. The global `JAVA_HOME` is never changed — only per-terminal
overrides. Full step-by-step build + smoke instructions, with expected visuals for the mobile view,
are in [`MANUAL-E2E-TEST.md`](./MANUAL-E2E-TEST.md).

## Bring-up on a real machine (after DSN-021 prerequisites are met)

1. Scaffold (outside the npm web workspaces) with the app name `DsnCompanion` and package `com.dsncompanion`,
   into a temp directory, then copy the generated skeleton into `apps/android/` **without overwriting** the authored files above:
   `npx @react-native-community/cli@latest init DsnCompanion --package-name com.dsncompanion --skip-install`
2. Drop in / keep the authored files (`App.tsx`, `src/SmsSignal.ts`, the two `.kt` files).
3. `cd apps/android && npm install && npm i react-native-webview`
4. Register the package in the generated `MainApplication.kt`:
   ```kotlin
   override fun getPackages(): List<ReactPackage> =
     PackageList(this).packages.apply {
       add(SmsSignalPackage())
     }
   ```
5. Add the permission to the generated `android/app/src/main/AndroidManifest.xml` (inside `<manifest>`):
   ```xml
   <uses-permission android:name="android.permission.RECEIVE_SMS" />
   ```
   Do **NOT** add a manifest `<receiver>` for SMS: registration is programmatic and session-scoped.
   The debug build must allow cleartext to `localhost` (the RN debug template does via `usesCleartextTraffic`; confirm).
6. Start the web app and API (repo root), then expose every port the device needs:
   ```bash
   npm run dev:web            # web at :5173 (proxies /api/v1 and /healthz to the API at :8787)
   adb reverse tcp:5173 tcp:5173    # web app
   adb reverse tcp:8787 tcp:8787    # API
   adb reverse tcp:9099 tcp:9099    # Firebase AUTH emulator — the WebView's sign-in calls it directly
   adb reverse tcp:8081 tcp:8081    # Metro (debug JS bundle)
   ```
7. Build and install: `cd android && ./gradlew assembleDebug`, then `adb install -r app/build/outputs/apk/debug/app-debug.apk`.
   For debug builds, also start Metro (`npx react-native start`) so the JS bundle can load.
8. Launch the app and tap **I consent - start session**; grant the RECEIVE_SMS runtime permission.
9. Smoke test (emulator):
   ```bash
   adb emu sms send VM-DEMOBK "Your account is blocked. Pay Rs 50000 to keep funds safe."
   ```
   **Expected:** the SMS appears in the Decision view as a received-message claim. After **Withdraw consent / end
   session** (or before consent), the same command produces no signal.

## Honesty invariants

- Call audio is **simulated** and labelled on every screen: "Simulated call audio - this demo does not record calls."
- A received SMS is a message **claim**, not a verified fact, and never an actually-paid record.
- Consent is explicit and the listener is **session-scoped AND foreground-scoped**: the native receiver is
  registered only while the session is open and the app is active, and is unregistered on background or
  session end — never always-on, never in the background, and **no SMS-history read** (only live
  `SMS_RECEIVED` broadcasts while listening). A multi-part SMS is concatenated into one claim.
- Simulated bank/authority/reporting/payment behaviour elsewhere in DSN remains labelled simulated.
