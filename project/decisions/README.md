# Implementation Decision Records

The locked PRD is canonical for product and founder decisions; do not duplicate those decisions here.

Create `NNNN-short-title.md` only for consequential implementation choices involving architecture, interfaces, APIs, data contracts, privacy/security, model behavior, dependencies, deployment, or meaningful trade-offs future agents must understand.

Statuses are Proposed, Accepted, Rejected, and Superseded. Accepted records are immutable. A changed choice receives a new record and both records link through `Supersedes` / `Superseded by`.

A discovered product-scope change stays Proposed until the founder approves it. No decision record authorizes an agent to edit the PRD.

Use the next four-digit sequence number and `TEMPLATE.md`. Link the relevant DSN task, PRD section, implementation commit, and later superseding record.

If GitHub becomes canonical for tasks, decision records remain in the repository.
