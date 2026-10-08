# Native Android companion shell + consented SMS signal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a sideloadable debug Android APK — a React Native shell hosting the DSN-018 web UI in a WebView — that surfaces one real, consented, session-scoped on-device signal (an incoming SMS) into the active case's decision view, without any backend change and without claiming call-audio capture.

**Architecture:** A React Native (Android) app renders a full-screen `react-native-webview` that loads the existing `apps/web` build. A native Kotlin `SmsSignalModule` (a `SMS_RECEIVED` BroadcastReceiver) runs only after explicit in-app consent and only while a Safe Session is open; it emits `{from, body, receivedAt}` to the RN JS layer, which injects a typed `dsn:sms-signal` envelope into the WebView via `window.postMessage`. A small, feature-detected `message` listener in `apps/web` validates the envelope and renders the SMS as a *message claim* in the decision view. No API/Firestore/Gemini/contract/state-machine change.

**Tech Stack:** React Native 0.74+ (Android), `react-native-webview`, Kotlin (native module), TypeScript + React 19 (existing `apps/web`, Vitest), Gradle (debug APK).

**Spec:** `docs/superpowers/specs/2026-10-07-native-android-shell-sms-signal-design.md` (binding; its Honesty & safety invariants and Scope are authoritative). Decision: `project/decisions/0009-native-android-companion-shell.md`. Task: `project/tasks/backlog/DSN-020-native-android-shell-sms-signal.md`.

## Global Constraints

- **Android-only; debug/sideload APK only.** No iOS, no Play Store release/signing in scope. `RECEIVE_SMS` is a sensitive permission — a sideloaded debug build needs no Play review; label the build as a demo.
- **Consented + session-scoped, never always-on.** The SMS receiver is registered only after explicit in-app consent AND an open Safe Session; it is unregistered on session close or consent withdrawal. No background listening. No reading SMS history/inbox. (Respects PRD non-goal line 339.)
- **Call audio stays simulated and labelled.** The app never records calls and never claims to. Keep a persistent "Simulated call audio — not recorded" label.
- **A received SMS is a *message claim*, not a verified fact.** Any payee/amount in the body is shown as proposed/claimed; it never fills an actually-paid field and never auto-marks anything verified. No scam probability, mental-state label, blacklist, or fabricated authority outcome. 1930/cybercrime stay real and un-filed.
- **No backend/API/contract/state-machine change.** The signal enters the existing client case model (React state), not Firestore. The browser never calls Firestore/Gemini directly — the authenticated API owns both.
- **The web-side change is additive and feature-detected.** `apps/web` must stay byte-behaviour-compatible in a plain browser (the ally/reviewer surface); the existing web suite (130 tests) stays green; typecheck clean.
- **Hygiene:** synthetic demo data only; personal no-reply commit identity; `git diff --check` clean; never commit secrets, workplace identity/paths, or an absolute JDK/Android-SDK path (shell-only exports). Atomic commits, subject begins `DSN-020:`.

## Review Focus

- **Spoofed / foreign `message` events.** A `postMessage` listener is an injection surface. The listener must act ONLY on a well-formed `dsn:sms-signal` envelope and ignore every other message (ads, extensions, malformed JSON, wrong type tag) without throwing. → pinned in Task 1 tests.
- **SMS arriving with no consent / no open session.** Must be dropped at the native layer (receiver not registered). → pinned in Task 4 smoke steps.
- **SMS body containing a payee/amount.** Must render as *claimed*, never as paid or verified; the component shows no "paid"/"verified" wording for a signal. → pinned in Task 2 tests.
- **Listener running in a plain browser (no shell).** Must be completely inert; existing screens unaffected, no stray UI. → pinned in Task 2 tests.
- **Consent withdrawn / session closed mid-flow.** Receiver unregistered; no further signals reach the WebView. → pinned in Task 4 smoke steps.

---

### Task 1: Web signal contract + pure ingestion (TDD)

**Files:**
- Create: `apps/web/src/deviceSignals.ts`
- Test: `apps/web/src/deviceSignals.test.ts`

**Interfaces:**
- Produces: `DsnSmsSignal` (wire envelope), `DeviceSignal` (in-app, adds `id`), `parseSmsSignalMessage(data: unknown): DsnSmsSignal | null`, `ingestSmsSignal(current: DeviceSignal[], sig: DsnSmsSignal): DeviceSignal[]`. Consumed by Task 2 (listener/render) and Task 5 (bridge envelope shape).

- [ ] **Step 1: Write the failing tests**

```ts
import { parseSmsSignalMessage, ingestSmsSignal, type DeviceSignal } from './deviceSignals';

const valid = { type: 'dsn:sms-signal', from: 'VM-DEMOBK', body: 'Your a/c is blocked. Call 1800...', receivedAt: '2026-10-07T10:00:00.000Z' };

describe('parseSmsSignalMessage', () => {
  it('accepts a well-formed envelope object', () => {
    expect(parseSmsSignalMessage(valid)).toEqual(valid);
  });
  it('accepts the same envelope as a JSON string', () => {
    expect(parseSmsSignalMessage(JSON.stringify(valid))).toEqual(valid);
  });
  it('rejects a foreign message (wrong/absent type tag) with null', () => {
    expect(parseSmsSignalMessage({ type: 'webpackHotUpdate' })).toBeNull();
    expect(parseSmsSignalMessage({ from: 'x', body: 'y', receivedAt: 'z' })).toBeNull();
  });
  it('rejects malformed JSON and non-objects without throwing', () => {
    expect(parseSmsSignalMessage('{not json')).toBeNull();
    expect(parseSmsSignalMessage(42)).toBeNull();
    expect(parseSmsSignalMessage(null)).toBeNull();
  });
  it('rejects an envelope missing or mistyping required fields', () => {
    expect(parseSmsSignalMessage({ ...valid, from: undefined })).toBeNull();
    expect(parseSmsSignalMessage({ ...valid, body: 123 })).toBeNull();
    expect(parseSmsSignalMessage({ ...valid, from: '' })).toBeNull();
  });
});

describe('ingestSmsSignal', () => {
  it('appends a signal with a stable id', () => {
    const out = ingestSmsSignal([], valid);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ from: valid.from, body: valid.body, receivedAt: valid.receivedAt });
    expect(out[0].id).toBeTruthy();
  });
  it('de-duplicates on (from, receivedAt)', () => {
    const once: DeviceSignal[] = ingestSmsSignal([], valid);
    expect(ingestSmsSignal(once, valid)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure.** `npm --workspace apps/web run test -- deviceSignals` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
/** DSN-020 on-device signal from the native companion. A received message is a
 * CLAIM — never a verified fact and never an actually-paid record. */
export interface DsnSmsSignal {
  type: 'dsn:sms-signal';
  from: string;
  body: string;
  receivedAt: string; // ISO 8601
}

/** In-app representation after ingestion (adds a stable id for dedupe + React keys). */
export interface DeviceSignal {
  id: string;
  from: string;
  body: string;
  receivedAt: string;
}

/** Validate an untrusted `message` payload. Returns the typed signal only for a
 * well-formed dsn:sms-signal envelope; null for anything else. Never throws. */
export function parseSmsSignalMessage(data: unknown): DsnSmsSignal | null {
  let obj: unknown = data;
  if (typeof data === 'string') {
    try { obj = JSON.parse(data); } catch { return null; }
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (o.type !== 'dsn:sms-signal') return null;
  if (typeof o.from !== 'string' || typeof o.body !== 'string' || typeof o.receivedAt !== 'string') return null;
  if (o.from.length === 0 || o.receivedAt.length === 0) return null;
  return { type: 'dsn:sms-signal', from: o.from, body: o.body, receivedAt: o.receivedAt };
}

/** Append a validated signal, de-duplicating on (from, receivedAt). */
export function ingestSmsSignal(current: DeviceSignal[], sig: DsnSmsSignal): DeviceSignal[] {
  const id = `${sig.from}|${sig.receivedAt}`;
  if (current.some((s) => s.id === id)) return current;
  return [...current, { id, from: sig.from, body: sig.body, receivedAt: sig.receivedAt }];
}
```

- [ ] **Step 4: Run to verify pass.** `npm --workspace apps/web run test -- deviceSignals` → PASS. `npm --workspace apps/web run typecheck` → clean.

- [ ] **Step 5: Commit.**
```bash
git add apps/web/src/deviceSignals.ts apps/web/src/deviceSignals.test.ts
git commit -m "DSN-020: web SMS-signal envelope contract + pure ingestion (TDD)"
```

---

### Task 2: Web render + feature-detected listener

**Files:**
- Create: `apps/web/src/DeviceSignalList.tsx`
- Test: `apps/web/src/DeviceSignalList.test.tsx`
- Modify: `apps/web/src/App.tsx` (add the `message` listener → state → render; no change to existing screen props)
- Test: `apps/web/src/App.test.tsx` (add listener-ingestion + inert-in-browser cases)

**Interfaces:**
- Consumes: `DeviceSignal`, `parseSmsSignalMessage`, `ingestSmsSignal` from Task 1.
- Produces: `DeviceSignalList` (props `{ signals: DeviceSignal[] }`) using the DSN-018 `ui/` layer. App holds `deviceSignals` state and renders the list in the Decision area.

- [ ] **Step 1: Write the failing component test**

```tsx
import { render, screen } from '@testing-library/react';
import { DeviceSignalList } from './DeviceSignalList';

const sig = { id: 'VM-DEMOBK|2026-10-07T10:00:00.000Z', from: 'VM-DEMOBK', body: 'Pay Rs 50000 to new a/c to keep funds safe', receivedAt: '2026-10-07T10:00:00.000Z' };

describe('DeviceSignalList', () => {
  it('shows the SMS as a received message claim with provenance and sender', () => {
    render(<DeviceSignalList signals={[sig]} />);
    expect(screen.getByText(/incoming sms/i)).toBeVisible();
    expect(screen.getByText(/VM-DEMOBK/)).toBeVisible();
    expect(screen.getByText(/message received on device/i)).toBeVisible();
  });
  it('frames the message as a claim, never as paid or verified', () => {
    render(<DeviceSignalList signals={[sig]} />);
    expect(screen.getByText(/not a verified fact|claim/i)).toBeVisible();
    expect(screen.queryByText(/\bpaid\b|\bverified\b/i)).toBeNull();
  });
  it('renders nothing when there are no signals', () => {
    const { container } = render(<DeviceSignalList signals={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run to verify failure.** `npm --workspace apps/web run test -- DeviceSignalList` → FAIL.

- [ ] **Step 3: Implement `DeviceSignalList.tsx`**

```tsx
import { Badge, Callout, Card } from './ui';
import type { DeviceSignal } from './deviceSignals';

/** Renders consented on-device signals (DSN-020) as received-message CLAIMS.
 * Never presents a message as paid or verified. Inert when `signals` is empty. */
export function DeviceSignalList({ signals }: { signals: DeviceSignal[] }): React.JSX.Element | null {
  if (signals.length === 0) return null;
  return (
    <section aria-label="On-device signals">
      <Card title="On-device signals">
        <Callout kind="info">
          A received message is a claim, not a verified fact or a completed payment.
        </Callout>
        <ul className="flex flex-col gap-space-3">
          {signals.map((s) => (
            <li key={s.id} className="flex flex-col gap-space-1 rounded-md border border-border p-space-3">
              <div className="flex items-center gap-space-2">
                <strong>Incoming SMS</strong>
                <Badge tone="info">Message received on device</Badge>
              </div>
              <p className="text-sm text-text-muted">From {s.from} · {s.receivedAt}</p>
              <p>{s.body}</p>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
```

*(Verify the exact `ui/` export names and `Badge` tones against `apps/web/src/ui/index.ts`; use an existing tone — do not invent one.)*

- [ ] **Step 4: Wire the listener in `App.tsx`.** Add `deviceSignals` state and a mount effect; render `<DeviceSignalList>` in the Decision step area. The listener is naturally feature-detected: it only mutates state on a valid envelope, so a plain browser (which never receives one) is unaffected.

```tsx
// imports
import { DeviceSignalList } from './DeviceSignalList';
import { parseSmsSignalMessage, ingestSmsSignal, type DeviceSignal } from './deviceSignals';

// inside the component
const [deviceSignals, setDeviceSignals] = useState<DeviceSignal[]>([]);
useEffect(() => {
  const onMessage = (e: MessageEvent) => {
    const sig = parseSmsSignalMessage(e.data);
    if (sig) setDeviceSignals((prev) => ingestSmsSignal(prev, sig));
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}, []);
// in the Decision step render, below the DecisionMap:
// <DeviceSignalList signals={deviceSignals} />
```

- [ ] **Step 5: Add App-level tests**

```tsx
// In App.test.tsx — ingestion via a posted envelope, and inert on foreign messages.
it('ingests a dsn:sms-signal posted into the window and shows it in the decision view', async () => {
  // ...render App, advance to the Decision step as the existing tests do...
  window.postMessage(JSON.stringify({ type: 'dsn:sms-signal', from: 'VM-DEMOBK', body: 'blocked, call now', receivedAt: '2026-10-07T10:00:00.000Z' }), '*');
  expect(await screen.findByText(/incoming sms/i)).toBeVisible();
});

it('ignores a foreign window message (no device-signal UI appears)', async () => {
  // ...render App at the Decision step...
  window.postMessage(JSON.stringify({ type: 'webpackHotUpdate' }), '*');
  // allow the event loop to flush, then assert absence
  await new Promise((r) => setTimeout(r, 0));
  expect(screen.queryByText(/incoming sms/i)).toBeNull();
});
```

*(Reuse the existing App.test harness/driving pattern to reach the Decision step; do not weaken any existing safety-copy assertion. `window.postMessage` in jsdom dispatches asynchronously — use `findBy*` / flush as shown.)*

- [ ] **Step 6: Run the full web suite + typecheck.** `npm --workspace apps/web run test` → all green (130 existing + new). `npm --workspace apps/web run typecheck` → clean.

- [ ] **Step 7: Commit.**
```bash
git add apps/web/src/DeviceSignalList.tsx apps/web/src/DeviceSignalList.test.tsx apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "DSN-020: feature-detected SMS-signal listener + decision-view render"
```

---

### Task 3: React Native Android scaffold hosting the web build

**Files:**
- Create: `apps/android/` (RN project: `package.json`, `app.json`, `index.js`, `App.tsx`, `android/`)
- Create: `apps/android/App.tsx` (full-screen WebView)
- Create: `apps/android/README.md` (build/sideload steps; no secrets, no absolute SDK path)

**Environment prerequisite (document, do not commit paths):** Android SDK + a JDK 21 on `JAVA_HOME`, React Native CLI. If unavailable, record the blocked step honestly rather than inferring success.

- [ ] **Step 1: Scaffold.** Initialize an RN app under `apps/android/` (e.g. `npx @react-native-community/cli@latest init DsnCompanion --directory apps/android --skip-install` then install), add `react-native-webview`. Keep it OUT of the npm web workspaces unless the integrator opts in (serialized `package.json`/lockfile ownership).

- [ ] **Step 2: Host the web build in a WebView**

```tsx
// apps/android/App.tsx
import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// For the demo, point at the local dev web server (adb reverse tcp:5173) or a
// bundled asset build. Never hard-code a private host or credential here.
const WEB_URL = 'http://localhost:5173';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.fill}>
      <WebView source={{ uri: WEB_URL }} style={styles.fill} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ fill: { flex: 1 } });
```

- [ ] **Step 3: Build + smoke (documented).**
```bash
# web dev server reachable from the device/emulator:
#   npm run dev:web   (then: adb reverse tcp:5173 tcp:5173)
cd apps/android && ./android/gradlew -p android assembleDebug
# install + launch; confirm the DSN-018 UI boots inside the WebView
```
Expected: the app boots to the styled DSN-018 journey. Record the result (or the blocked toolchain step) in the task.

- [ ] **Step 4: Commit.**
```bash
git add apps/android
git commit -m "DSN-020: React Native Android scaffold hosting the web UI in a WebView"
```

---

### Task 4: Native `SmsSignalModule` — consent-gated, session-scoped

**Files:**
- Create: `apps/android/android/app/src/main/java/com/dsncompanion/SmsSignalModule.kt`
- Create: `apps/android/android/app/src/main/java/com/dsncompanion/SmsSignalPackage.kt`
- Modify: `apps/android/android/app/src/main/java/com/dsncompanion/MainApplication.kt` (register the package)
- Modify: `apps/android/android/app/src/main/AndroidManifest.xml` (`RECEIVE_SMS` permission)

- [ ] **Step 1: Declare the permission** in `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECEIVE_SMS" />
```
Do NOT add a manifest-declared `<receiver>` for `SMS_RECEIVED` (that would make it background/always-on). Register the receiver **programmatically** so it exists only between `startListening()` and `stopListening()`.

- [ ] **Step 2: Implement the native module**

```kotlin
package com.dsncompanion

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.provider.Telephony
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/** DSN-020: consented, session-scoped SMS signal. Registers a SMS_RECEIVED
 * receiver only while listening; never reads SMS history; never runs in the
 * background. Emits one event per incoming message to the JS layer. */
class SmsSignalModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  private var receiver: BroadcastReceiver? = null
  override fun getName() = "SmsSignal"

  @ReactMethod
  fun startListening(promise: Promise) {
    if (receiver != null) { promise.resolve(true); return }
    val r = object : BroadcastReceiver() {
      override fun onReceive(c: Context?, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        for (msg in Telephony.Sms.Intents.getMessagesFromIntent(intent)) {
          val payload = Arguments.createMap().apply {
            putString("from", msg.originatingAddress ?: "unknown")
            putString("body", msg.messageBody ?: "")
            putString("receivedAt", java.time.Instant.now().toString())
          }
          ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("dsn:sms-signal", payload)
        }
      }
    }
    ctx.registerReceiver(r, IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION))
    receiver = r
    promise.resolve(true)
  }

  @ReactMethod
  fun stopListening(promise: Promise) {
    receiver?.let { ctx.unregisterReceiver(it) }
    receiver = null
    promise.resolve(true)
  }

  // Required for NativeEventEmitter on newer RN; no-op counters.
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}
}
```

```kotlin
// SmsSignalPackage.kt
package com.dsncompanion
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SmsSignalPackage : ReactPackage {
  override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(SmsSignalModule(ctx))
  override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
```
Register `SmsSignalPackage()` in `MainApplication.kt`'s package list.

*(Verify the module/`DeviceEventManagerModule`/`Telephony` APIs against the RN version actually scaffolded — use context7 for current `react-native` + `react-native-webview` docs if signatures differ.)*

- [ ] **Step 3: Smoke test (documented) — covers Review Focus items.**
```bash
# With the app foregrounded and listening started (consent granted, session open):
adb emu sms send VM-DEMOBK "Your account is blocked. Pay Rs 50000 to keep funds safe."
```
Verify: (a) the event fires only after `startListening`; (b) before consent / after `stopListening` the same `adb emu sms send` produces NO event; (c) no SMS-history read occurs. Record results (or blocked toolchain) in the task.

- [ ] **Step 4: Commit.**
```bash
git add apps/android/android
git commit -m "DSN-020: consented, session-scoped native SMS signal module (Kotlin)"
```

---

### Task 5: Bridge + consent UI + honesty labels + finalize

**Files:**
- Modify: `apps/android/App.tsx` (NativeEventEmitter → WebView injection; consent gate; session lifecycle; honesty label)
- Create: `apps/android/src/SmsSignal.ts` (typed JS wrapper over the native module)
- Modify: `docs/demo-runbook.md` (native sideload + `adb emu sms send` demo steps)
- Modify: `project/tasks/in-progress/DSN-020-...md` (finalize record — integrator moves to `done` at merge)

**Interfaces:**
- Consumes: native `SmsSignal` module (`startListening`/`stopListening`, `"dsn:sms-signal"` event) from Task 4; the `dsn:sms-signal` envelope shape from Task 1.

- [ ] **Step 1: JS wrapper** `apps/android/src/SmsSignal.ts`:
```ts
import { NativeModules, NativeEventEmitter } from 'react-native';
const { SmsSignal } = NativeModules;
const emitter = new NativeEventEmitter(SmsSignal);
export function startListening(): Promise<boolean> { return SmsSignal.startListening(); }
export function stopListening(): Promise<boolean> { return SmsSignal.stopListening(); }
export function onSms(cb: (p: { from: string; body: string; receivedAt: string }) => void) {
  return emitter.addListener('dsn:sms-signal', cb);
}
```

- [ ] **Step 2: Consent gate + bridge in `apps/android/App.tsx`.** Show an explicit consent screen; only on accept (and while the session is open) call `startListening()`. On each native event, inject the typed envelope into the WebView:
```tsx
const envelope = JSON.stringify({ type: 'dsn:sms-signal', ...p });
webViewRef.current?.injectJavaScript(`window.postMessage(${JSON.stringify(envelope)}, '*'); true;`);
```
Request the runtime `RECEIVE_SMS` permission before `startListening`. Call `stopListening()` on consent withdrawal / unmount. Render a persistent, visible label: **"Simulated call audio — this demo does not record calls."**

- [ ] **Step 3: End-to-end smoke (documented).** Grant consent → `adb emu sms send ...` → the SMS appears in the WebView's decision view as a received-message claim. Withdraw consent → no further signals. Record results (or blocked toolchain) in the task.

- [ ] **Step 4: Runbook.** Add to `docs/demo-runbook.md`: building/sideloading the debug APK, `adb reverse tcp:5173 tcp:5173`, the consent step, and the `adb emu sms send` demo line. Label it a demo build.

- [ ] **Step 5: Finalize the task record** (claim it into `in-progress` first per WORKFLOW): commands/results/changed paths/commit IDs, and honest limitations (any blocked Android-toolchain step; call audio simulated). Leave the `done` move to the integrator merge.

- [ ] **Step 6: Commit.**
```bash
git add apps/android/App.tsx apps/android/src/SmsSignal.ts docs/demo-runbook.md project/tasks/in-progress/DSN-020-native-android-shell-sms-signal.md
git commit -m "DSN-020: SMS bridge to WebView, consent gate, honesty label, runbook + record"
```

---

## Notes for the integrator (post-implementation)

- Branch off `main` in an isolated worktree; one task branch for the series. The web tasks (1–2) are fully testable in Vitest; the native tasks (3–5) require an Android SDK + JDK 21 + RN CLI — if that toolchain is unavailable, record the blocked build/smoke steps honestly (as the API emulator suite was) rather than inferring success.
- Run the post-integration gate: full web suite green (130 + new), 3-workspace typecheck clean, `git diff --check` clean, hygiene grep clean (incl. no absolute JDK/Android-SDK path committed), personal no-reply identity. Then `--no-ff` merge to local main and move the task record to `done`. Pushing is authorized; deploy/Play release is not.
- If the native toolchain forces a change to the web contract (it should not — the envelope is fixed in Task 1), stop and coordinate rather than diverging the two sides.
