# DSN-016: Core MVP UI wireframes

- **Scope:** core
- **Priority:** P0
- **Owner:** Primary agent (serialized design owner)
- **Branch/worktree:** `task/DSN-016-core-ui-wireframes` / `.worktrees/dsn-016-core-ui-wireframes`
- **Owned paths:** `docs/design/wireframes/` and this task record only
- **Dependencies:** DSN-000; locked PRD Part I
- **PRD references:** Core MVP C1–C12; causal acceptance matrix; end-to-end demo; Cup trust, safety, privacy, and accessibility gates
- **Decision references:** None; wireframes must not supersede the locked PRD or accepted implementation decisions
- **Started:** 2026-10-02 IST
- **Last updated:** 2026-10-02 IST

## Outcome

Provide visual, implementation-guiding wireframes for the Core MVP's decisive user and ally journeys without changing product scope or building production UI.

## Boundaries

- Includes key screen layouts, copy hierarchy, responsive behavior, quiet/check/pause/degraded states, simulation and provenance labels, ally-minimization, and same-case recovery/evidence handoff.
- Excludes product code, final branding/logo, animations, stretch features, and changes to the locked PRD or implementation plan.

## Acceptance checks

- [x] Reviewable visual artifacts cover Plan, controlled session plus payment, the joined-context decision and non-joined/degraded variants, official verification and ally review, resolved prevention, and same-case recovery/evidence.
- [x] Every screen visibly respects its PRD trust boundary: controlled input, persistent simulated integration labels, source/unknown/correction distinction, no risk or mental-state score, explicit human decision, minimum ally packet, and no false official acknowledgement.
- [x] A short design guide maps each frame to Core MVP capabilities, defines responsive behavior and reusable UI patterns, and identifies open brand choices without restating the PRD wholesale.
- [x] SVG files parse with `xmllint --noout docs/design/wireframes/*.svg`; visual review confirms text is legible and that desktop and narrow-screen examples do not hide required actions.
- [x] Locked PRD remains byte-for-byte unchanged; `git diff --check` passes; no product code or remote push is included.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits:** `37f9988` (seven SVG frames, gallery, design guide); review-handoff commit contains this record.
- **Integration commit:** Not integrated
- **Commands and results:** `xmllint --noout docs/design/wireframes/*.svg` passed; all seven SVGs rasterized with `sharp`; local visual inspection of all seven frames found no clipping or hidden primary actions; gallery and guide both reference every SVG exactly once; `git diff --cached --check` passed for the artifacts. Locked PRD SHA-256 remains `548bdc6c81b908ff58daf654c0a6daaa29de1f4df0a1274f32128d4c6a7c712c`. Independent read-only critique found no remaining material defect after corrections.
- **Post-integration verification:** Not run
- **Changed paths:** `docs/design/wireframes/` (seven SVGs, `README.md`, `index.html`) and this task record.
- **Limitations or skipped checks:** These are static design guides. Working UI behavior, actual responsiveness at other viewport sizes, keyboard/screen-reader support, and 200% text scaling require implementation tests. Final identity/branding and founder visual approval remain open.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Founder reviews the wireframes and copy hierarchy. The integrator then independently reviews and integrates the approved artifact, or returns it to `in-progress` with concrete feedback.
- **Unresolved issues:** Founder visual approval; final identity/branding intentionally open.
