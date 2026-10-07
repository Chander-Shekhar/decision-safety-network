# 0009: Native Android companion shell (React Native hosting the web UI) + one consented on-device SMS signal

- **Status:** Accepted
- **Date:** 2026-10-07
- **Owners:** Integrator (founder-authorized scope change)
- **Related task:** DSN-020
- **PRD references:** Initial surface (line 10), Deployment (line 108), Prototype components 1–2 (250–251), Explicit Cup non-goals (339–340), near-term companion note (763) — updated under founder authorization 2026-10-07
- **Builds on:** DSN-018 (styled web journey, reused via WebView), decision 0008 (styling stack)
- **Supersedes:** None
- **Superseded by:** None

## Context

The founder challenged the implicit "responsive web is the surface" framing: scam
calls, SMS, and payment pressure arrive on the phone, and the product's core
"connect the dots across signals" value depends on on-device signals a sandboxed
web page cannot observe (incoming SMS, screen-share/remote-access, SIM change,
app installs). A native Android companion is the honest home for that correlation
and the credible production vessel for the PRD's B2B2C OEM/dialer/telecom
embedding. For the Cup it also replaces an asserted mobile story with a live one —
a real incoming SMS flowing into the case — without overclaiming call-audio
capture (no ordinary standalone Android app can do that; Play banned the
accessibility-API workaround in May 2022, and call recording belongs to the
system/OEM dialer or carrier).

## Decision

- Ship a **React Native (Android) shell** whose primary screen is a full-screen
  **WebView hosting the existing `apps/web` build**. The DSN-018 UI is reused in
  full; there is **no UI rewrite** into native components.
  - *React Native was the founder's explicit choice over Capacitor/TWA. The
    integrator noted Capacitor as lower-setup for the identical "reuse the web UI
    + one native signal" outcome; the founder chose RN. TWA was rejected because
    it is Chrome-in-a-shell and cannot host a native signal module.*
- Add exactly **one** real on-device signal: a native Kotlin `SmsSignalModule`
  (`SMS_RECEIVED` BroadcastReceiver) that is **consented and session-scoped** —
  active only while a Safe Session is open and only after explicit in-app
  consent, unregistered on session close/withdrawal, never background, never
  reading SMS history.
- Bridge the SMS to the WebView as a typed envelope `{ type: 'dsn:sms-signal',
  from, body, receivedAt }`; a small **feature-detected** web-side listener
  ingests it as a case **signal** (a *message claim*, not a verified fact) and
  surfaces it in the Decision Map with provenance + timestamp. The web build
  stays byte-compatible for the ally/reviewers in a plain browser.
- **Honesty invariants:** call audio stays simulated and labelled, the app never
  records or claims to record calls; a proposed payee/amount parsed from an SMS
  is shown as proposed/claimed and never fills actually-paid fields; no scam
  probability / mental-state / blacklist / fabricated authority outcome;
  1930/cybercrime stay real and are never auto-filed.
- **Android-only**, **debug/sideload APK only** (sensitive SMS permissions; no
  Play release in scope), **no backend/API/contract/state-machine change** (the
  signal enters the existing client case model; browser still never calls
  Firestore/Gemini directly).

## Consequences

- New build track (RN toolchain, Android SDK, native-module bridge) separate from
  the npm web workspaces; a sideloadable demo APK becomes a deliverable.
- The only web-side change is the additive, feature-detected SMS listener;
  `apps/web` otherwise unchanged and still the ally/reviewer surface.
- The PRD is updated (founder-authorized) to name the native companion as the
  primary consumer surface and to clarify the call-capture non-goal; the existing
  acceptance, trust, simulation, and scope boundaries are preserved.
- A full APK build may hit the same JDK/Android-SDK environment gaps already
  recorded for the API emulator suite; such checks are flagged, not inferred.

## Alternatives considered

### Capacitor wrapper
Integrator's recommendation on ROI (thinnest path to "reuse web UI + one native
plugin"). Not chosen — founder preferred React Native.

### Trusted Web Activity (TWA)
Rejected: Chrome-in-a-shell; cannot host a native signal module, which defeats the
reason to go native.

### Native rewrite of the UI in RN components
Rejected: discards the DSN-018 UI for little demo gain — poor ROI.

### Stay web-only, demo on a phone
Rejected: a sandboxed web page cannot observe on-device signals, so "connect the
dots" would remain asserted rather than demonstrated.

## Verification

Deferred to DSN-020 implementation. Planned: web-side unit test for the
feature-detected listener (ingests a valid envelope, ignores malformed, inert when
absent; existing 130 web tests stay green, typecheck clean); native smoke test via
`adb emu sms send` (consent gate blocks until accepted; receiver unregisters on
session close). Spec:
`docs/superpowers/specs/2026-10-07-native-android-shell-sms-signal-design.md`.
