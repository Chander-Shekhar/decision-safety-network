# DSN-025: Live call capture + transcription (labeled prototype path)

- **Scope:** core
- **Priority:** P1
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** None until claimed (expected: `apps/android/**`, session API in `apps/api/src/session*`, `apps/web/src/**` for the labeled fallback)
- **Dependencies:** DSN-021 (native toolchain), DSN-024 (screening); pairs with DSN-024
- **PRD references:** Part I — Decision 15; C2; Fixed scope (Interaction); live/simulated table; Prototype components (Interaction source); non-goals (consented, labeled, not covert)
- **Decision references:** 0009, 0010
- **Started:** Not started
- **Last updated:** 2026-10-11

## Outcome

The Android companion captures and transcribes a real device call (consented, user-configured per DSN-023) into the Safe Session, feeding the same segment pipeline the controlled transcript uses; the controlled transcript remains a reproducible fallback. The capture path is clearly labeled a prototype capability.

## Boundaries

- Included: capture + transcription on the controlled device via an OEM/accessibility/dialer-integrated path, segment emission into the existing session API, visible "prototype capture" + consent labeling, graceful fallback to the controlled transcript.
- Excluded: store-distributable call capture across arbitrary devices; covert/always-on recording; any change to downstream fact/policy semantics.

## Acceptance checks

- [ ] A live call on the controlled device produces transcript segments that drive the Safe Session end to end.
- [ ] Capture is gated on consent + the user's call-listening preference; the prototype-capture label is visible.
- [ ] Controlled-transcript fallback still works unchanged (reproducible evaluation path intact).
- [ ] Native smoke verified on device/emulator; web + API suites green; no downstream contract change.

## Verification evidence

- **Commits:** None
- **Integration commit:** Not integrated
- **Commands and results:** None
- **Post-integration verification:** Not run
- **Changed paths:** None
- **Limitations or skipped checks:** None

## Blocker or deferral

Not applicable. (Note: native build historically needs the DSN-021 toolchain — JDK 21, Android SDK, RN CLI.)

## Handoff

- **Next action:** Prepare and claim after DSN-024; confirm native toolchain is available.
- **Unresolved issues:** OEM/accessibility capture mechanism to be chosen during implementation and recorded in a decision.
