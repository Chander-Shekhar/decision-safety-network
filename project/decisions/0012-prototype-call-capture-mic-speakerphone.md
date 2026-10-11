# 0012: Prototype call capture via microphone during speakerphone (reconciles 0009 with 0010/DSN-025)

- **Status:** Accepted
- **Date:** 2026-10-12
- **Owners:** Founder (Chander Shekhar); recorded by orchestrator
- **Related task:** DSN-025
- **PRD references:** Part I — Decision 15 (labeled prototype call capture); C2; Fixed scope (Interaction); What is live/controlled/simulated; Prototype components (Interaction source); non-goals (consented, labeled, not covert)
- **Refines:** [0009](0009-native-android-companion-shell.md) (its "the app never records or claims to record calls" invariant)
- **Supersedes:** None
- **Superseded by:** None

## Context

Decision 0009 established — correctly — that a stock, standalone Android app cannot tap the telephony audio stream: Google banned the accessibility-API call-recording workaround in May 2022, and true call recording belongs to the system/OEM dialer or the carrier. On that basis 0009 set the honesty invariant "call audio stays simulated and labelled; the app never records or claims to record calls," and the DSN-020 companion renders "Simulated call audio — this demo does not record calls."

Decision 0010 (DSN-025, founder-authorized 2026-10-11) then asked the companion to **capture and transcribe a real device call** as a clearly-labeled prototype capability. Taken literally against 0009 that is a contradiction, and the naive reading — tapping the call stream — is exactly the overclaim 0009 and 0010 both warn judges against.

On 2026-10-12 the founder resolved the fork: demonstrate a **real capture via the device microphone while the call is on speakerphone**, honestly labeled as a prototype workaround. This records real audio of a real call (both parties audible on speaker) without claiming to tap the carrier/telephony stream, and the founder will verify it on their own Android device. The founder was explicit that a real capture — even via this workaround — is far better for the demo than an audio-upload step, which is a last resort only.

## Decision

1. **Capture mechanism:** the companion records from the **microphone** (`RECORD_AUDIO`) while the user has the call on **speakerphone**, as a labeled prototype path. It does **not** tap the telephony/carrier audio stream and makes no claim to.
2. **Transcription:** prefer **on-device streaming speech-to-text** (e.g. Android `SpeechRecognizer`) producing text segments, so raw call audio need not leave the device. Raw-audio upload to a server transcriber is a **last-resort fallback only**, not the primary path.
3. **Pipeline:** transcript segments feed the **same session segment pipeline** the controlled transcript already uses (mirror the DSN-020 SMS bridge pattern: a typed envelope from the native layer to the WebView'd web client). Target **no downstream fact/policy/contract/state-machine change**.
4. **Consent + gating:** capture is gated on explicit in-app consent **and** the user's DSN-023 `callListening` preference, session-scoped and foreground-scoped (same discipline as the SMS signal) — never covert, never always-on, never background.
5. **Labeling (reconciles 0009):** the "Simulated call audio — does not record calls" label is **replaced** on the capture path with an honest **prototype-capture + consent** label, e.g. "Prototype capture — recording this call's audio via the microphone on speakerphone, with your consent." Where audio is NOT being captured (controlled-transcript fallback, no consent), the simulated/!capturing state stays labeled accordingly.
6. **Fallback:** the controlled transcript remains a reproducible evaluation path and the graceful fallback when capture/consent is unavailable.
7. **Verification:** the real speakerphone-call smoke is **verified by the founder on a physical Android device**. The orchestrator builds and unit/pipeline-tests the pipe and may smoke the mic→segment path on the emulator mic; real-telephony-call verification is a founder-on-device step, recorded honestly as such.

## Consequences

- **Positive:** a genuinely live capture moment in the demo (real call audio → live transcript → the same decision pipeline) without the Play-banned telephony-tap overclaim; honest, consented, and labeled.
- **Cost / follow-up:** `RECORD_AUDIO` runtime permission + mic lifecycle on the native side; on-device STT availability varies by device/locale (fallback matters); the 0009 companion label must be updated on the capture path; real-call verification depends on the founder's device, so it is a founder-verified acceptance item rather than one the orchestrator can close locally.
- Speakerphone is required for the far-party to be audible to the mic; this is a known, labeled limitation of the workaround, not a defect.

## Alternatives considered

- **Tap the telephony/carrier audio stream (OEM/accessibility):** rejected — Play-banned, not emulator-testable, highest overclaim risk; the exact thing 0009 ruled out.
- **Keep call audio simulated, only reframe the UI:** rejected by the founder — it adds no real capture and under-sells the capability.
- **Audio-upload-first (record a clip, upload to a server transcriber):** demoted to last-resort fallback — the founder prefers a live capture workaround over an upload step.
