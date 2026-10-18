# 0025: Product name is "Second Voice"

- **Status:** Accepted
- **Date:** 2026-10-18
- **Owners:** Founder / DSN-038
- **Related task:** DSN-038
- **PRD references:** Title and product references in `Decision_Safety_Network_PRD_Draft.md` (unchanged, see below)
- **Supersedes:** "Decision Safety Network" as the product's public name (it was an internal working name)
- **Superseded by:** None

## Context

"Decision Safety Network" was an internal working name, not a final one. The product helps someone under pressure on a suspicious call slow down, check what the caller claims, bring in a trusted ally, and recover and report if they already paid. Candidates considered: Pause, Second Voice, Hold On, Verify First, Steady, Safe Call, CallGuard, Tether.

## Decision

The product is named **Second Voice**, chosen by the founder. It reflects the core idea: a scammer isolates you on the call, and this is the trusted second voice that is never absent.

- **Renamed (user-facing and shipped surfaces):** app wordmark and welcome copy, About, page titles, generated report/export HTML titles, ally WhatsApp/summary header, wireframe titles, `README.md`, `scripts/smoke.sh`.
- **Deliberately not renamed:** `DSN-NNN` task IDs and the `DSN_*` environment variables, the `@dsn/contracts` package scope, the repository and directory names, `AGENTS.md`, the locked PRD file and its title, and existing decision/plan/spec history. These are internal identifiers or records; the PRD stays locked until the founder asks for a change.

## Consequences

- Internal docs still say "Decision Safety Network" or "DSN"; treat them as the earlier working name.
- No trademark, domain, or app-store availability check has been done for "Second Voice". Do this before any public launch.
- A follow-up can rename the repository and package scope, and update the PRD title, on the founder's request.
