# DSN companion — manual end-to-end test (mobile view)

Follow this top to bottom to build, install, and **visually** verify the DSN Android companion on an
emulator (or a USB device). Every money/bank/authority behaviour is **simulated**; synthetic data only.
No report is ever filed on your behalf.

What you are proving:

1. The app hosts the DSN web UI in a full-screen WebView (the real "mobile view" of the product).
2. A **consented, session-scoped, foreground-scoped** native SMS listener forwards an incoming SMS into
   the web app as a message **claim** — never a verified fact, never a completed payment.
3. Withdrawing consent (or backgrounding the app) stops capture immediately.

Expected total time: ~15 min once prerequisites are in place (the first Gradle build is the slow part).

---

## 0. Prerequisites (one-time)

Installed via DSN-021 (Android Studio + SDK). Confirm you have:

- Android SDK at `$ANDROID_HOME` (`~/Library/Android/sdk` on macOS) with platform **android-35**,
  build-tools, platform-tools, an emulator, and an AVD (this guide uses one named `dsn_api35`:
  android-35, google_apis, arm64-v8a).
- **Two JDKs reachable** (see the next section for why):
  - **JDK 21** — runs the main Gradle JVM and the Firebase emulators.
  - **JDK 17** — used only as the Kotlin compile toolchain for the React Native Gradle plugin.
- Node 20+ and npm (this repo's web/API workspaces).

> You do **not** change your global `JAVA_HOME`. Everything below overrides it **per terminal** only.

---

## 1. Scaffold the native project (first time only)

The committed `apps/android/` holds only the DSN-specific sources (`App.tsx`, `src/SmsSignal.ts`, the two
`.kt` files). The React Native skeleton is generated, not checked in. Generate it **outside** the npm
web workspaces (e.g. `~/dsn-native-build/`) so the web workspace resolver is not disturbed:

```sh
mkdir -p ~/dsn-native-build && cd ~/dsn-native-build
printf 'registry=https://registry.npmjs.org/\n' > .npmrc   # bypass any corporate npm proxy
npx --yes @react-native-community/cli@latest init DsnCompanion --version 0.87.1 --skip-install --pm npm
cd DsnCompanion
cp .npmrc .                                                 # keep the public registry for installs here too
```

Then copy the authored DSN sources over the scaffold (do **not** overwrite them the other way):

```sh
DSN=/path/to/this/repo/apps/android
cp "$DSN/App.tsx" ./App.tsx
cp "$DSN/src/SmsSignal.ts" ./src/SmsSignal.ts
cp "$DSN/android/app/src/main/java/com/dsncompanion/SmsSignalModule.kt"  android/app/src/main/java/com/dsncompanion/
cp "$DSN/android/app/src/main/java/com/dsncompanion/SmsSignalPackage.kt" android/app/src/main/java/com/dsncompanion/
npm install
npm install react-native-webview
```

Register the native package and permission in the generated files:

- `android/app/src/main/java/com/dsncompanion/MainApplication.kt` — inside
  `PackageList(this).packages.apply { … }` add:
  ```kotlin
  add(SmsSignalPackage()) // DSN-020: consented, session-scoped SMS signal
  ```
- `android/app/src/main/AndroidManifest.xml` — inside `<manifest>`, after the INTERNET permission:
  ```xml
  <uses-permission android:name="android.permission.RECEIVE_SMS" />
  ```
  Do **not** add a manifest `<receiver>`: registration is programmatic and session-scoped.

---

## 2. Per-terminal environment

Open **three terminals**. In **each** one, export the SDK tools and (where noted) the JDK override.
These are shell-only; never commit a resolved absolute path.

```sh
# All terminals: SDK tools on PATH (ANDROID_HOME is already in ~/.zshrc).
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

---

## 3. Start the backend and device

### Terminal 1 — web + API (both need JDK 21 for the Firebase emulators)

```sh
export JAVA_HOME="$(brew --prefix openjdk@21)"   # per-terminal only; do not touch global JAVA_HOME
cd /path/to/this/repo
npm run dev:api    # Firebase auth+firestore emulators + API on :8787  (JDK 21 required)
```

In a spare terminal (or background the one above) also run:

```sh
cd /path/to/this/repo
npm run dev:web    # Vite dev server on :5173, proxies /api/v1 and /healthz to :8787
```

Sanity check from the host:

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/healthz   # expect 200
```

### Terminal 2 — emulator

```sh
emulator -avd dsn_api35 &
adb wait-for-device
```

**Bridge every port the WebView and Metro need** (the device's `localhost` → your host):

```sh
adb reverse tcp:5173 tcp:5173    # web app
adb reverse tcp:8787 tcp:8787    # API
adb reverse tcp:9099 tcp:9099    # Firebase AUTH emulator — the WebView calls this directly; easy to forget
adb reverse tcp:8081 tcp:8081    # Metro (debug bundle)
adb reverse --list               # confirm all four
```

> If you skip `:9099`, "Create synthetic user" fails with "Something went wrong. Nothing was changed."
> — the sign-in call cannot reach the Auth emulator.

### Terminal 3 — Metro bundler (debug builds load JS from here)

```sh
export PATH="$ANDROID_HOME/platform-tools:$PATH"
cd ~/dsn-native-build/DsnCompanion
npx react-native start      # Metro on :8081
```

---

## 4. Build and install the app

Back in Terminal 2 (or a fourth terminal with the SDK PATH set):

```sh
export JAVA_HOME="$(brew --prefix openjdk@21)"            # main Gradle JVM = JDK 21 (per-terminal)
cd ~/dsn-native-build/DsnCompanion/android

# JDK 17 is the Kotlin compile toolchain for the RN gradle-plugin. If Gradle cannot auto-detect a
# JDK 17 install, point it at one explicitly (use YOUR jdk-17 home; do not commit the path):
./gradlew assembleDebug -Dorg.gradle.java.installations.paths="<path-to-your-jdk17-home>"

adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.dsncompanion/.MainActivity
```

Expected: the app launches to the **consent screen** (see Test A step 1). First build pulls Gradle/AGP
dependencies and is slow; later builds are fast.

> See **Troubleshooting** if the build fails with a `DOCTYPE is disallowed` / foojay POM error.

Pre-grant the SMS permission so the runtime prompt does not interrupt the flow:

```sh
adb shell pm grant com.dsncompanion android.permission.RECEIVE_SMS
```

---

## 5. Test A — positive: a consented session captures the SMS as a claim

| Step | Action | Expected (mobile view) |
|------|--------|------------------------|
| A1 | Launch the app. | **Consent screen.** Yellow honesty strip at the very top: "Simulated call audio — this demo does not record calls." Title "Consent to observe incoming SMS", copy explaining session-only + foreground-only + no history read, and an **I CONSENT – START SESSION** button. |
| A2 | Tap **I CONSENT – START SESSION**. | The WebView loads the DSN web app. Footer shows **"Listening for incoming SMS (this session only)"** and a **WITHDRAW CONSENT / END SESSION** bar. Landing shows the Simulated banner and **Create synthetic user** / **Create synthetic ally**. |
| A3 | Tap **Create synthetic user**. | No error. The journey rail appears: **1. Plan** (active), 2. Session (unlocks after you save a plan), 3. Decision (locked). *If you see "Something went wrong" — the `:9099` reverse is missing; fix it (step 3) and retry.* |
| A4 | On **Plan**, scroll to the bottom of "My saved Safety Plan" and tap **Save Safety Plan** (defaults are fine). | No error. **2. Session** unlocks in the rail. |
| A5 | Tap **2. Session** → **Start controlled session**. | A line like **"Case <uuid>"** appears. **3. Decision** unlocks. |
| A6 | Tap **3. Decision**. | The **Decision Map · Live processing** card shows. There is **no** "On-device signals" card yet (none received). |
| A7 | Send a simulated SMS from the host: `adb emu sms send VM-DEMOBK "Your account is blocked. Pay Rs 50000 to keep funds safe."` | Within ~1–2s an **"On-device signals"** card appears in the Decision view containing: the info line **"A received message is a claim, not a verified fact or a completed payment."**, then **Incoming SMS** with a **MESSAGE RECEIVED ON DEVICE** badge, **From VM-DEMOBK · <ISO-8601 timestamp>**, and the message body. |

**A passes if:** the SMS shows up as a *claim* card (not as a verified fact, not as a paid transfer),
with the honesty line present.

---

## 6. Test B — negative: withdrawn consent does not capture

| Step | Action | Expected |
|------|--------|----------|
| B1 | Tap **WITHDRAW CONSENT / END SESSION** (dismiss the "Open debugger" LogBox toast first if it covers the bar). | You return to the **consent screen**. The "Listening…" footer is gone — the native receiver is unregistered. |
| B2 | Send another SMS while withdrawn: `adb emu sms send VM-DEMOBK "Second message while consent withdrawn."` | The Android system may show its own SMS notification (the OS received it) — that is **not** the DSN app. |
| B3 | Tap **I CONSENT – START SESSION** again, then walk **Create synthetic user → Save Safety Plan → Start controlled session → Decision**. | In the Decision view there is **no "On-device signals" card** — the withdrawn-state message was never captured and is not replayed. |

**B passes if:** the message sent while consent was withdrawn never appears in the app.

---

## 7. Test C — optional: foreground-scope

| Step | Action | Expected |
|------|--------|----------|
| C1 | In an open, consented session on the Decision view, press **Home** (`adb shell input keyevent KEYCODE_HOME`). | App goes to background; the receiver unregisters. |
| C2 | Send `adb emu sms send VM-DEMOBK "Backgrounded message."` | Nothing captured. |
| C3 | Reopen the app (`adb shell am start -n com.dsncompanion/.MainActivity`). | The backgrounded message does **not** appear as a new claim. |

---

## 8. Teardown

```sh
# Stop Metro (Terminal 3) and the web/API (Terminal 1) with Ctrl-C.
adb reverse --remove-all
adb emu kill          # or close the emulator window
```

The scaffold under `~/dsn-native-build/` is disposable — delete it any time; regenerate with section 1.

---

## 9. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| "Something went wrong. Nothing was changed." on Create synthetic user | The WebView's Firebase sign-in can't reach the Auth emulator. Run `adb reverse tcp:9099 tcp:9099`. |
| Red screen "Unable to load script … index.android.bundle" | Debug builds need Metro. Start it (Terminal 3) and `adb reverse tcp:8081 tcp:8081`. |
| `dev:api` exits: "no longer supports Java version before 21" | Launch that terminal with `export JAVA_HOME="$(brew --prefix openjdk@21)"`. |
| Gradle build: `[Fatal Error] …foojay…pom:1:10: DOCTYPE is disallowed` | Gradle 9's strict POM parser choked on an HTML-bodied 404 from a mirrored/proxied repo while resolving the foojay toolchain plugin. Run the **main** Gradle JVM on JDK 21 (`export JAVA_HOME="$(brew --prefix openjdk@21)"`). In a corporate-proxy environment you may additionally need to point plugin repos at the public Gradle Plugin Portal and skip foojay auto-provisioning in the generated scaffold's `node_modules/@react-native/gradle-plugin/settings.gradle.kts` — that edit lives in throwaway `node_modules` and is never committed. |
| `Cannot find a Java installation matching languageVersion=17` | The RN gradle-plugin compiles Kotlin against JDK 17. Make a JDK 17 discoverable, or pass `-Dorg.gradle.java.installations.paths="<path-to-your-jdk17-home>"`. |
| App stays on the launcher after `monkey`/install | Start it explicitly: `adb shell am start -n com.dsncompanion/.MainActivity`. |

---

## Honesty invariants (must hold on every screen)

- Call audio is **simulated** and the label is always visible.
- A received SMS is a message **claim** — never shown as a verified fact or an actually-paid transfer.
- The listener is consented, **session-scoped AND foreground-scoped**, reads no SMS history, and observes
  only live `SMS_RECEIVED` broadcasts while listening. Multi-part SMS are concatenated into one claim.
