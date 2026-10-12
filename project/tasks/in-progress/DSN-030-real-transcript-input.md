# DSN-030: Real transcript input (replace the hardcoded scenario button)

- **Scope:** core (de-hardcoding pass — founder-directed)
- **Priority:** P1
- **Owner:** Orchestrator (acts as implementer + integrator; gated by an independent review before local merge)
- **Branch/worktree:** `task/DSN-030-real-transcript-input` (local only — not pushed)
- **Owned paths:** `apps/web/src/App.tsx` (integrator-owned), new `apps/web/src/TranscriptEntry.tsx` (+ test), `apps/api/src/gemini.ts` (additive `transcribe`), new `apps/api/src/transcription-routes.ts` (+ test), `apps/api/src/server.ts` (mount only), `apps/api/test/fake-gemini.ts` (additive `transcribe`), additive `packages/contracts/src/facts.ts` (GeminiPort `transcribe` + audio input type). Serialized/not owned: no change to policy/payment/verification/web-verification/state-machine; those are DSN-031.
- **Dependencies:** DSN-025 live-capture bridge (segments + facts/extract pipeline — the input paths reuse it).
- **PRD references:** Part I — live capture as a labeled prototype (Decision 0012 basis); C12 untrusted-transcript rule; no scam-probability/mental-state field.
- **Decision references:** 0004 (extraction authorization/consent), 0012 (prototype capture labeling); new decision for the audio-transcription mechanism to be recorded at integration.
- **Started:** 2026-10-12
- **Last updated:** 2026-10-12

## Outcome

The demo no longer carries a "Play attack scenario" button that injects a fixed scripted transcript. The user supplies the call themselves through two real inputs — paste the call text, or upload an audio recording of the call — both of which flow into the existing segments + `facts/extract` pipeline. The payee picker reflects real payee choices instead of two magic hardcoded account ids. Nothing in the decision logic keys off any literal demo string.

## Boundaries

- Included: remove `playScenario`/"Play attack scenario"; a transcript paste box; an audio-upload → transcription path (new `GeminiPort.transcribe` + route, fake-tested; live only where cloud Gemini is provisioned); audio never persisted; prototype-capture labeling preserved; payee picker populated from a free-text new-payee entry plus any known payees (server still derives `newPayee`).
- Excluded: any policy/verification/decision change (DSN-031); real cloud provisioning; retaining audio; any new trusted/consequential state from the transcript (an extracted fact stays model-origin until the owner confirms it).

## Acceptance checks

- [ ] No "Play attack scenario" control and no `playScenario` scripted-transcript function remain; grep is clean.
- [ ] Paste input: pasted call text becomes ordered segments and runs `facts/extract`, identical to the live-capture bridge; labeled prototype capture.
- [ ] Audio upload: an uploaded recording posts to the transcription route, which calls `GeminiPort.transcribe` and returns ordered segments that then run `facts/extract`; audio is never written to Firestore; route is owner-checked and consent-gated (mirrors `assertExtractionAuthorized`); fake-gemini covers it.
- [ ] Payee picker offers a free-text new-payee entry (and any known payees); `newPayee` stays server-derived (`isKnownPayee`); no `safe-new`/`safe-known` literals drive behavior.
- [ ] API + web suites green; typecheck clean. Independent reviewer returns READY (or findings resolved).

## Verification evidence

_(filled at completion)_

## Blocker or deferral

Audio transcription and fact extraction require cloud Gemini, which is not provisioned in this environment and will not be provisioned here without separate founder authorization. The audio path is therefore built and unit-tested against `fake-gemini`; it runs live only where cloud Gemini is available. The paste path is fully exercisable offline. This is a provisioning limit, not a deferral of the functionality.

## Handoff

_(filled at completion)_
