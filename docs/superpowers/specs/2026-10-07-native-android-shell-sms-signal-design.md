# Native Android companion shell + consented on-device SMS signal — design

- **Date:** 2026-10-07
- **Status:** Approved (founder, 2026-10-07)
- **Related task:** DSN-020
- **Related decision:** 0009 (native Android companion shell)
- **Builds on:** DSN-018 (styled, guided web journey — reused 100% via WebView), decision 0008 (styling stack)
- **PRD references:** Initial surface (line 10), Deployment (line 108), Prototype components 1–2 (lines 250–251), Explicit Cup non-goals (lines 339–340), near-term companion note (line 763)

## Why

Scam calls, messages, and payment pressure land on the victim's **phone**, and
the product's core value — "connect the dots across signals and act in the
pressured moment" — depends on signals a sandboxed web page structurally cannot
see (incoming SMS, screen-share/remote-access state, SIM changes, app installs).
A native Android companion is the honest home for that correlation story and the
more credible production vessel for the PRD's B2B2C OEM/dialer/telecom embedding.

For the AI Builder Cup this also closes a credibility gap: a native app that
reads a **real** on-device signal (an incoming SMS auto-flowing into the case)
produces a live "the phone connected the dots — you retyped nothing" moment that
a browser demo cannot, **without** overclaiming call-audio capture (which no
ordinary standalone app can do on modern Android — Play policy banned the
accessibility-API workaround in May 2022; call recording belongs to the
system/OEM dialer or carrier).

## What we build

A **React Native (Android) shell** whose primary screen is a full-screen
**WebView** that loads the existing `apps/web` build. The DSN-018 UI is reused
in full — **no UI rewrite**. On top of the WebView we add exactly **one** real
on-device signal and the bridge that carries it into the existing case model.

### Components

1. **RN Android app + WebView host.** Loads the web surface (bundled local
   assets or the hosted/dev URL). All existing screens, routing, and the
   phase-gated journey run unchanged inside the WebView.
2. **`SmsSignalModule` (native Kotlin).** A `BroadcastReceiver` for
   `android.provider.Telephony.SMS_RECEIVED`, registered/active **only while a
   Safe Session is open and only after explicit in-app consent**, and
   unregistered when the session closes or consent is withdrawn. It extracts
   `{ from, body, receivedAt }` from one incoming SMS and emits it to JS. It is
   **not** a persistent/background listener and does **not** read the SMS inbox
   history.
3. **Bridge → WebView.** RN forwards the SMS event into the WebView via
   `postMessage` / `injectJavaScript` as a typed envelope
   `{ type: 'dsn:sms-signal', from, body, receivedAt }`.
4. **Web-side listener (the only web change).** A small, **feature-detected**
   `message` listener in `apps/web` that validates the envelope and ingests the
   SMS as a new case **signal** (a *message claim*, not a verified fact),
   surfacing it in the Decision Map with provenance "Message received on device"
   + timestamp + sender. In a plain browser (no shell) the listener is inert and
   the web build is byte-for-byte the current one.

### The demo moment

Owner is in a Safe Session (simulated call transcript streaming) → a real scam
SMS lands on the demo device → it appears in the Decision Map as evidence
"Incoming SMS from `<sender>`", provenance "Message received on device",
timestamped, correlated with the ongoing call. The user retyped nothing.

## Honesty & safety invariants (binding)

- **Call audio stays simulated and labelled.** The app never records calls and
  never claims to. Any production call capture is via OEM/dialer/carrier/partner
  integration — stated honestly, demoed via the controlled transcript.
- **The SMS is real but a *message claim*, not a verified fact.** Same provenance
  discipline as the Decision Map: a proposed payee/amount parsed from an SMS is
  shown as *proposed/claimed* and never fills actually-paid fields; it never
  auto-marks anything verified.
- **Consented + session-scoped, never always-on.** The SMS read is gated by
  explicit in-app consent and active only during an open Safe Session — this is
  what keeps it inside PRD non-goal line 339 ("Always-on monitoring … of SMS …").
- **No new product claims.** No scam probability, mental-state label, public
  blacklist, or fabricated authority outcome. 1930/cybercrime.gov.in stay real
  and are never filed on the user's behalf.
- **Demo build only.** `READ_SMS`/`RECEIVE_SMS` are sensitive permissions; the
  Cup uses a **sideloaded debug APK** (no Play review needed) clearly labelled a
  demo build.

## Scope

**In:** RN Android shell; WebView host of the DSN-018 web build; `SmsSignalModule`
+ consent gate + session-scoped lifecycle; the bridge; the feature-detected
web-side listener and its ingestion into the existing case/signal model; honesty
labels; a sideloadable debug APK; a bridge smoke test + a web-side unit test.

**Out (non-goals for DSN-020):** iOS; call-audio capture of any kind; more than
the one SMS signal; Play Store release/signing; background or always-on
listening; reading SMS history/inbox; any API/contract/state-machine change
(the SMS flows into the existing client case model only); push notifications.
All existing PRD Cup non-goals continue to hold.

## Architecture notes

- **No backend change.** The signal enters the existing client case model; no new
  route, request/response shape, Firestore access, or Gemini call. The browser
  still never talks to Firestore/Gemini directly — the authenticated API owns both.
- **Web build compatibility.** The web-side listener must be additive and
  feature-detected so `apps/web` keeps serving the ally and reviewers in a plain
  browser unchanged.
- **Android-only.** The research persona is India/Android/UPI; iOS cannot read
  SMS or call state, so the native track is Android-only by design.

## Testing & verification

- **Web unit test:** the new listener ingests a valid `dsn:sms-signal` envelope
  into the case (evidence appears with provenance + timestamp), ignores malformed
  or foreign-origin messages, and is inert when the hook is absent. Existing web
  suite (130 tests) must stay green; typecheck clean.
- **Native smoke test:** an emulated incoming SMS (`adb emu sms send …`) reaches
  the WebView and renders the Decision Map evidence item; consent gate blocks it
  until accepted; closing the session unregisters the receiver.
- **Honest limitation:** a full RN/Android APK build may hit the same
  JDK/Android-SDK environment gaps already recorded for the API emulator suite;
  flag any unavailable check rather than infer success.

## Open items (not blocking the spec)

- Exact RN↔WebView bridge library/choice and whether the web assets are bundled
  or loaded from the hosted URL — settle in the implementation plan.
- SMS body parsing depth (sender + raw body is enough for the demo; structured
  payee/amount extraction is optional and, if added, stays *proposed/claimed*).
