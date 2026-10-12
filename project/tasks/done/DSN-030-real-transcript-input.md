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

- [x] No "Play attack scenario" control and no `playScenario` scripted-transcript function remain; grep is clean. (`grep -rn playScenario apps/web/src` → none; the button is replaced by `<TranscriptEntry>`.)
- [x] Paste input: pasted call text becomes ordered segments and runs `facts/extract`, identical to the live-capture bridge; labeled prototype capture. (`submitPastedTranscript` → `appendTurnsAndExtract` posts each turn to `cases/:id/segments` then `facts/extract`; `TranscriptEntry` renders the "Prototype capture … is not stored" label.)
- [x] Audio upload: an uploaded recording posts to the transcription route, which calls the transcription port and returns ordered turns that then run `facts/extract`; audio is never written to Firestore; route is owner-checked and consent-gated; fake double covers it. (`POST cases/:id/transcript/audio` returns `{turns}` and writes nothing — proven by `transcription.test.ts` "persists nothing"; `assertExtractionAuthorized` runs before any `transcribe` — proven by the counting-port tests asserting `calls===0` for non-owner and consent-revoked. Separate `TranscriptionPort` (not `GeminiPort`), so no inline fake needed a new method.)
- [x] Payee picker offers a free-text new-payee entry (and any registered accounts); `newPayee` stays server-derived (`isKnownPayee`); no `safe-new`/`safe-known` literals drive behavior. (Select lists `plan.bankAccounts` + a "New payee…" free-text entry; the client sends only `beneficiaryId`; `payment.ts` derives `newPayee`. No scenario literal remains in non-test `web/src`/`api/src`.)
- [x] API + web suites green; typecheck clean; independent reviewer READY. (See evidence below.)

## Verification evidence

- **Commits (branch `task/DSN-030-real-transcript-input`):** `a3314cb` (claim + DSN-031 backlog), `5ff6eee` (implementation), `a6e248a` (review finding #1 fix).
- **Commands and results:** `npm run typecheck` clean (contracts + api + web). `npm --workspace apps/web run test` → 22 files, 201/201 (was 196; +5 `TranscriptEntry`). API under emulators (`firebase emulators:exec --only auth,firestore`, JDK 21) → 22 files, 411/411 (was 405; +6 `transcription.test.ts`). (`MetadataLookupWarning` lines are benign.)
- **Independent review:** general-purpose adversarial reviewer returned **READY**, no blockers (re-ran all suites). One recommended hardening (finding #1, order-base retry wedge) was fixed in `a6e248a`; findings #2–#5 deferred below.
- **Changed paths:** `packages/contracts/src/facts.ts` (additive `AudioInput`/`TranscriptTurn`/`TranscriptionPort`); `apps/api/src/{gemini.ts (additive transcription port),transcription-routes.ts (new),server.ts (mount)}`; `apps/api/test/{fake-gemini.ts,transcription.test.ts (new)}`; `apps/web/src/{App.tsx,TranscriptEntry.tsx (new),TranscriptEntry.test.tsx (new)}`; `.gitignore` (ignore `.claude/`).

## Blocker or deferral

Audio transcription and fact extraction require cloud Gemini, which is not provisioned in this environment and will not be provisioned here without separate founder authorization. The audio path is therefore built and unit-tested against a fake transcription port; it runs live only where cloud Gemini is available. The paste path is fully exercisable offline. This is a provisioning limit, not a deferral of the functionality.

## Deferred (non-blocking) review nits

1. **Order base drifts from the server on reload (pre-existing).** `appendTurnsAndExtract` and the live bridge both key order off local state, which is never rehydrated from the server; a reload on an existing case can send order 1 against a server already at N. Shared with the DSN-025 live bridge — out of DSN-030 scope. Fix: seed local order from the case view's `lastSegmentOrder`.
2. **Transcription failure surfaces as a generic 500.** A Gemini/JSON failure in the audio route is rethrown rather than mapped to a friendly degraded response (unlike `facts/extract`, which returns `{status:'degraded'}`). Low value while audio is cloud-only; a mapped 502 would be nicer.
3. **No bound on the returned turn count / text length.** A very long recording yields many sequential segment round trips, each bumping the case version. Demo clips are short; bound later.
4. **Paste speaker-prefix regex can mislabel a line.** "Note: send 50,000" becomes speaker "note". Cosmetic (segment speaker label only).

## Handoff

- **Next action:** merge to local main (integrator), then DSN-031 (live open-web verification + feeding verification into the decision) and the authorized Playwright pass over the new input flow. Interactive UI polish remains per founder direction.
- **Unresolved issues:** none blocking. Live audio transcription awaits cloud Gemini provisioning (founder action). Deferred nits above.
