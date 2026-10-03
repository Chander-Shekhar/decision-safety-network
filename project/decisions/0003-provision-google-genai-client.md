# 0003: Provision the @google/genai client at a lockfile-safe pinned version

- **Status:** Accepted
- **Date:** 2026-10-03
- **Owners:** Integrator (orchestration session)
- **Related task:** DSN-006 (enables it); provisioned as a serialized integrator change on `main`
- **PRD references:** C3 living source-linked case; C12 prompt-injection resistance
- **Supersedes:** None
- **Superseded by:** None

## Context

DSN-006 implements structured, source-linked fact extraction via `@google/genai`
on Google Cloud (model `gemini-3.5-flash-lite` at the `global` endpoint), as
chosen in decision 0001. The concrete adapter `apps/api/src/gemini.ts` must
import `@google/genai`, so the package must be a resolved dependency for the API
workspace to typecheck. The dependency was not pinned by the foundation task
(DSN-003), and `apps/api/package.json`/`package-lock.json` are serialized
integrator-owned files, outside DSN-006's owned paths. The dependency had to be
provisioned before dispatching DSN-006.

Constraints: public npm registry only (project `.npmrc`); exact pins
(`save-exact=true`); the global `min-release-age=3` npm policy rejects versions
published within the cutoff window. On 2026-10-03 the cutoff was 2026-09-30
13:53, so `@google/genai@2.25.0` (published 2026-09-30 22:51) and newer were
blocked; `2.24.0` (2026-09-22) is the latest allowed release.

Installing a client library is local work — it is **not** a cloud call, resource
creation, or deployment, which remain gated to DSN-014 under separate founder
authorization. DSN-006 exercises the client only through a fake `GeminiPort` in
tests; no real model call is made by provisioning this package.

## Decision

Add `@google/genai@2.24.0` (exact) to `apps/api` dependencies and commit the
regenerated `package-lock.json`. Resolve all entries from
`registry.npmjs.org` (verified: zero `sfdc.net`/`repo.local` URLs in the
lockfile). Do not upgrade past `2.24.0` until the min-release-age window permits
a newer release and DSN-006/DSN-014 need it.

## Consequences

- Positive: DSN-006 can import the real adapter and typecheck/build locally;
  the live path is wired for DSN-014 without any cloud dependency now.
- Follow-up obligation (security): `npm audit --omit=dev` reports **2 moderate**
  transitive advisories introduced by this package — `uuid` ("Missing buffer
  bounds check in v3/v5/v6 when `buf` is provided", range `<11.1.1`) reached via
  `gaxios` (`6.4.0 - 6.7.1`), Google's HTTP client. `npm audit fix` (non-forcing)
  cannot resolve them because `@google/genai@2.24.0` constrains `gaxios`; only
  `--force` (a breaking SDK change) would, which is out of scope and violates the
  exact-pin intent. The advisory is narrow: it triggers only when `uuid` is
  called with a caller-provided output buffer, which the SDK's identifier
  generation does not do. Accepted as low real risk for local, test-only use.
  **Must be revisited before DSN-014 enables live/production calls:** re-run the
  audit and bump `@google/genai`/`gaxios`/`uuid` to a fixed, min-release-age-eligible
  version when upstream ships a non-breaking fix. Flagged to the founder.

## Alternatives considered

### Pin a newer `@google/genai` (≥2.25.0)
Rejected: blocked by the `min-release-age=3` policy on 2026-10-03. Bypassing the
control was not considered (same stance as DSN-003's version pinning).

### Add an `overrides` entry to force `uuid` ≥ 11.1.1
Rejected for now: overriding a transitive dependency of a Google SDK risks
breaking `gaxios` if it relies on `uuid`'s older surface; not worth the risk for
a non-triggered advisory at local test scale. Reconsider at DSN-014 if upstream
has not released a fix.

### Defer the dependency; implement only the `GeminiPort` interface
Rejected: plan Task 4 Step 3 requires the concrete adapter (`gemini.ts`) to use
`@google/genai`; leaving it unimportable would block the task's typecheck/build.

## Verification

- `apps/api/package.json` pins `@google/genai: 2.24.0`; lockfile resolves it from
  `registry.npmjs.org`; `grep -c "sfdc.net\|repo.local" package-lock.json` → 0.
- `npm ci && npm run typecheck` → exit 0 across all three workspaces.
- Re-run `npm audit --omit=dev` at DSN-014 to confirm the two advisories are
  cleared (or re-accepted with evidence) before any live Gemini call ships.
