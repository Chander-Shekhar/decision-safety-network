# DSN companion - native Android shell (DSN-020)

**Android-only, sideloaded DEBUG/demo build.** Not a Play Store release. Hosts the DSN web app in a WebView and
forwards consented, session-scoped incoming SMS to it as a message *claim*. Synthetic demo data only.

## Status: BUILD AND SMOKE ARE BLOCKED (not done)

Prerequisites live in task **DSN-021** (Android SDK, JDK 21 on PATH, React Native CLI). They were **NOT satisfied**
on the machine where these files were authored, so nothing here has been built, installed, or smoke-tested.
Only the DSN-specific sources are committed; the React Native project skeleton (gradle wrapper, `settings.gradle`,
`MainActivity`, `MainApplication`, `build.gradle`) is intentionally absent and is generated at bring-up.

Authored here:
- `App.tsx` - WebView host, consent gate, SMS-to-WebView bridge, persistent honesty label
- `src/SmsSignal.ts` - JS wrapper over the native module
- `android/app/src/main/java/com/dsncompanion/SmsSignalModule.kt`, `SmsSignalPackage.kt`

Signatures marked `verify against RN <version> on scaffold` in the sources must be checked against the scaffolded RN version.

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
6. Start the web app and API (repo root), then expose both to the device/emulator:
   ```bash
   npm run dev:web            # web at :5173 (proxies /api/v1 and /healthz to the API at :8787)
   adb reverse tcp:5173 tcp:5173
   adb reverse tcp:8787 tcp:8787
   ```
7. Build and install: `cd android && ./gradlew assembleDebug`, then `adb install -r app/build/outputs/apk/debug/app-debug.apk`.
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
- Consent is explicit and the listener is **session-scoped**: never always-on, never in the background,
  and **no SMS-history read** (only live `SMS_RECEIVED` broadcasts while listening).
- Simulated bank/authority/reporting/payment behaviour elsewhere in DSN remains labelled simulated.
