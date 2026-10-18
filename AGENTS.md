# Decision Safety Network — Agent Operating Contract

## Mission and authority

Build the AI Builder Cup Core MVP defined in `Decision_Safety_Network_PRD_Draft.md` without weakening its acceptance, trust, simulation, or scope boundaries. The PRD is locked unless the founder explicitly requests a change.

Authority order:
1. Direct user instructions.
2. The locked PRD for intended product behavior and acceptance.
3. Accepted records in `project/decisions/` for implementation rationale.
4. The assigned task record for bounded execution scope.
5. Code, configuration, and tests for actual implementation state.

## Required read order

Before writing, read this file and the assigned task. Then read what the task actually touches — do not re-read everything every time. For product-facing behavior the PRD remains authoritative; consult the relevant PRD sections (executive brief, scope/proof boundary, Core MVP, Cup-ready definition) and any accepted decision the task depends on. Frontend work should consult `docs/design/wireframes/README.md` and the relevant frames for hierarchy and interactions. The approved Core MVP plan lives in `docs/superpowers/plans/2026-10-02-core-mvp-implementation-plan.md`. Read `project/WORKFLOW.md` before claiming or moving a task.

## Task ownership

- Track consequential work as a DSN task so outcomes stay reviewable. Trivial or exploratory changes may proceed without a formal task; capture the outcome afterward if it matters.
- When claiming a task, move it to `project/tasks/in-progress/` and record the owner and owned paths; add branch/worktree and start time when work runs concurrently with other agents.
- One active owner per task. No concurrent ownership of overlapping paths.
- Root configuration, schemas, lockfiles, this file, the PRD, and shared tracking files require serialized integrator ownership.
- If scope expands beyond declared paths during concurrent work, pause and coordinate before editing.

## Parallel development

- Use one task branch and isolated Git worktree per writing agent when work is concurrent.
- Inspect Git state before editing. Preserve unrelated changes.
- Never reset, discard, stash, amend, overwrite, or revert another agent's work.
- Workers do not merge their own task branch into `main`; the integrator reviews, verifies, and merges it.
- Make atomic commits whose subject begins with the task ID.

## Product and decision discipline

- Core MVP work precedes stretch work until every Cup-ready gate passes.
- Do not modify the locked PRD without explicit founder authorization.
- Record consequential architecture, API, data-contract, privacy/security, model, dependency, deployment, or interface choices in `project/decisions/`.
- Product-scope discoveries remain Proposed until founder approval.
- Never create an alternate task list, status file, memory file, decision log, or duplicated product summary.

## Verification and completion

- A file existing is not evidence that behavior works.
- For tracked tasks, record commands, results, changed paths, limitations, and commit IDs before review, in proportion to the change.
- Move a task to `done` only after its changes are integrated and applicable acceptance checks pass.
- `blocked` requires the blocker, evidence, next action, and owner of that action.
- `deferred` requires rationale, remaining risk, and an explicit resume condition.
- Report skipped or unavailable checks; never silently infer success.

## Safety and repository hygiene

- Use only non-real, non-production data. Never use real personal, financial, credential, or identifying data.
- Be honest about what is not yet live: disclose which integrations (bank, caller-ID, authority/reporting, payment) are not real through a single consolidated disclosure, not scattered inline caveats. Keep a light point-of-use indicator only where an action could otherwise be mistaken for a real-world effect. Prefer capability-forward wording; blanket "synthetic", "demo", or per-element "simulated" labels are not required.
- This is a public GitHub project. Use a personal GitHub identity or no-reply commit address; never publish any other email, credentials, or private local path.
- Never commit secrets, personal data, local credentials, generated build output, or environment files.
- Keep changes inside the assigned task and leave a complete handoff before stopping.
