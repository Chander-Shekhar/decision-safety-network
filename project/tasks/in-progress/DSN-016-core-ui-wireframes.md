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

- [ ] Reviewable visual artifacts cover Plan, controlled session plus payment, the joined-context decision and non-joined/degraded variants, official verification and ally review, resolved prevention, and same-case recovery/evidence.
- [ ] Every screen visibly respects its PRD trust boundary: controlled input, persistent simulated integration labels, source/unknown/correction distinction, no risk or mental-state score, explicit human decision, minimum ally packet, and no false official acknowledgement.
- [ ] A short design guide maps each frame to Core MVP capabilities, defines responsive behavior and reusable UI patterns, and identifies open brand choices without restating the PRD wholesale.
- [ ] SVG files parse with `xmllint --noout docs/design/wireframes/*.svg`; visual review confirms text is legible and that desktop and narrow-screen layouts do not hide required actions.
- [ ] Locked PRD remains byte-for-byte unchanged; `git diff --check` passes; no product code or remote push is included.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits:** None
- **Integration commit:** Not integrated
- **Commands and results:** None
- **Post-integration verification:** Not run
- **Changed paths:** None
- **Limitations or skipped checks:** Visuals are guidance for implementation and do not prove product behavior.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Create the isolated task worktree and draft wireframes for founder review.
- **Unresolved issues:** Founder review of the resulting visual direction; final identity/branding intentionally open.
