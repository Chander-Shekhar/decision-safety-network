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

Before writing, read this file and the assigned task. Every product-facing task also requires the PRD's AI Builder Cup executive brief, locked decisions, scope/proof boundary, Core MVP, and Cup-ready definition plus any additional sections referenced by the task. Read applicable implementation decisions and the approved Core MVP plan in `docs/superpowers/plans/2026-10-02-core-mvp-implementation-plan.md`. Frontend implementers and reviewers must also read `docs/design/wireframes/README.md` and the plan-mapped frames; they guide hierarchy and interactions, while the PRD remains authoritative. Read `project/WORKFLOW.md` before claiming or moving a task.

## Task ownership

- Do not begin implementation without a DSN task ID.
- Claim exactly one task by moving it to `project/tasks/in-progress/` and recording one owner, branch/worktree, owned paths, and start time.
- One active owner per task. No concurrent ownership of overlapping paths.
- Root configuration, schemas, lockfiles, this file, the PRD, and shared tracking files require serialized integrator ownership.
- If scope expands beyond declared paths, pause and coordinate before editing.

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
- Record commands, results, changed paths, limitations, and commit IDs in the task before review.
- Move a task to `done` only after its changes are integrated and applicable acceptance checks pass.
- `blocked` requires the blocker, evidence, next action, and owner of that action.
- `deferred` requires rationale, remaining risk, and an explicit resume condition.
- Report skipped or unavailable checks; never silently infer success.

## Safety and repository hygiene

- Use synthetic demo data only.
- Persistently label simulated bank, authority, reporting, and payment behavior as simulated.
- This is a public GitHub project. Use a personal GitHub identity or no-reply commit address; never publish a workplace email, credentials, or private local path.
- Never commit secrets, personal data, local credentials, generated build output, or environment files.
- Keep changes inside the assigned task and leave a complete handoff before stopping.
