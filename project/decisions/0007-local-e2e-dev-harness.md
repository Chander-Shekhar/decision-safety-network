# 0007: Local end-to-end dev harness (Vite serve + Firebase emulator auth + fake Gemini)

- **Status:** Accepted
- **Date:** 2026-10-05
- **Owners:** Integrator (DSN-014 continuation)
- **Related task:** DSN-014
- **PRD references:** Cup-ready clean deployed demo (local-rehearsal portion); C3/C12 (no real Gemini call, simulated labelling)
- **Supersedes:** None
- **Superseded by:** None

## Context

DSN-014 integrated the dependency-free composition but left the clickable
end-to-end demo blocked: the SPA was not served (no Vite dev config) and
`main.tsx` shipped a `FIREBASE_CLIENT_NOT_WIRED` auth stub, so the browser could
obtain no ID token. The founder authorized a **strictly local, no-cloud-cost**
manual clickable demo (and authorized pushing to the remote, not deploying),
explicitly reversing the earlier "defer dependencies" hold for this local case.
Running the real product locally needs browser sign-in that mints a token the
API's Firebase Admin SDK accepts, and an API that makes no billable Gemini call.

## Decision

Add a local-only dev harness, no cloud resource and no real Gemini call:

- `apps/web`: add the `firebase` client SDK (one new dependency) and a
  `vite.config.ts` dev server (`vite` was already a devDependency). `main.tsx`
  signs in anonymously against the **Auth emulator** (`connectAuthEmulator`,
  dummy `apiKey`, `projectId: demo-dsn`); the Vite dev server (`:5173`) proxies
  `/api/v1/**` and `/healthz` to the dev API (`:8787`).
- `apps/api`: add a dev-only `src/dev-server.ts` that boots `buildServer` with
  the deterministic `test/fake-gemini.ts` double and the Admin SDK pointed at
  the Auth + Firestore emulators. Add `tsx` (devDependency) to run the
  `.ts`/`.js`-specifier entry directly. It refuses to start outside the
  emulators; production still boots through `server.ts` `main()` with the live
  adapter, which rejects a test double.
- Root scripts: `dev:api` (`firebase emulators:exec … "PORT=8787 npx tsx apps/api/src/dev-server.ts"`) and `dev:web`. The Firestore emulator owns `:8080`, so the dev API uses `:8787`.

New dependencies: `firebase` (web), `tsx` (api dev). Both free and local-only.

## Consequences

- A real two-browser clickable journey runs locally with genuine Firebase
  tokens, Firestore state, and simulated Gemini — no cloud, no spend. Verified
  bootable (see Verification).
- Clears DSN-014 local sub-gates "SPA serve/build" and "browser auth"; deploy
  and the automated Playwright run remain blocked.
- The dev auth path (anonymous + `connectAuthEmulator`) is NOT the production
  path; the deployed build must drop `connectAuthEmulator` and load a real web
  config — tracked under the deploy sub-gate.
- Local Node is v24 while `engines` pins `22.x` (EBADENGINE warning only).

## Alternatives considered

### Browser mock `AuthProvider` with a hand-minted token (no `firebase` dep)

Rejected: the API's Admin SDK verifies real Firebase tokens; a hand-rolled
token would not verify against the Auth emulator without reimplementing its
token issuance, and it would diverge from the production auth path the demo is
meant to rehearse.

### `vite-node`/native Node TS stripping instead of `tsx`

Rejected: the codebase imports `.ts` sources via `.js` specifiers; native Node
type-stripping does not rewrite that resolution, and `vite-node` was not
installed either. `tsx` is the smallest dev-only runner that handles it.

## Verification

Booted locally: `npm run dev:api` (emulator + fake Gemini) + `npm run dev:web`.
`GET /healthz` via the Vite proxy returned `200 {"status":"ok"}`; an
unauthenticated `GET /api/v1/cases/x` through the proxy returned
`401 {"error":"UNAUTHENTICATED"}`; `/src/main.tsx` transformed (firebase imports
resolve). `npm run typecheck` clean across all three workspaces; web unit suite
109/109. Re-verify by repeating the two `dev:*` commands (JAVA_HOME must point
at a JDK for the emulator) and clicking the owner/ally journey in two windows.
