# DSN-033: Owner evidence selection so the ally-share preview works

- **Scope:** core (fixes a shell gap discovered under DSN-032: the owner-side ally-share preview is unreachable from the UI)
- **Priority:** P1
- **Owner:** Orchestrator (integrator) — implementation delegated to a subagent, integrated and merged by the orchestrator
- **Branch/worktree:** `task/DSN-033-ally-evidence-selection` (started 2026-10-12)
- **Owned paths (planned):** `apps/web/src/App.tsx` (Ally step: evidence-selection UI + preview handler), a small presentational component if extracted under `apps/web/src/`, `apps/web/src/*.test.tsx` (unit coverage for the new selection), `apps/web/e2e/journey.spec.ts` (re-enable the ally-preview assertion that DSN-032 had to drop). Does NOT change the API; the `promote` route and `ally-share-preview` endpoint already exist. Serialized integrator owns the merge.
- **Dependencies:** DSN-032 (merged) — the e2e harness and the recorded limitation this task resolves. DSN-011/DSN-027 ally-share flow on `main`.
- **PRD references:** Part I — ally reach / Safety Ally; the ally packet is an owner-approved allowlist (claim, proposed action, amount, verification gap, selected excerpts), never the raw transcript.
- **Decision references:** none expected; this is a UI wiring fix consistent with the existing packet contract. Add a decision only if the promote-on-preview approach proves consequential.

## Problem

The owner-side "Preview what my ally would see" button (`App.tsx`) posts `selectedEvidenceIds = segments.map((s) => s.id)` to `POST cases/:id/ally-share-preview`. But nothing in the UI (and no server auto-step) ever promotes a transcript segment into the case's `evidence` subcollection via `POST cases/:id/evidence/:segmentId/promote`. `previewAllyPacket` (`apps/api/src/ally.ts`) validates every selected id against the `evidence` subcollection only, so the preview always throws `UNKNOWN_EVIDENCE` (400) and the owner can never preview or share a case. (API behavior is correct and well-tested by `apps/api/test/ally.test.ts`, which seeds promoted evidence directly — confirming the missing UI step.)

## Outcome

The owner can choose which transcript excerpts the ally will see and successfully preview + share the case. On the Ally step the owner sees the current transcript segments as a selectable list (speaker + text), all selected by default. "Preview what my ally would see" promotes exactly the selected segments (idempotent per-segment promote) and previews with exactly those ids; the preview dialog renders the allowlisted packet. The Share path continues to bind to the previewed ids/version/hash. The raw transcript is still never shared — only the allowlisted packet and the chosen excerpts.

## Boundaries

- Included: Ally-step evidence-selection UI (segments as checkboxes, all checked by default; a clear empty-state when there are no segments); the preview handler promotes the selected segments before previewing; preview disabled when nothing is selected (avoids `INVALID_SELECTION`); unit coverage; re-enable the dropped ally-preview assertion in the e2e journey.
- Excluded: any API change (promote route + preview endpoint already exist and are correct); batching the promote calls into a new endpoint (per-segment idempotent promote is fine for the demo's segment counts); changing the packet contract or allowlist; the DSN-022 visual polish pass.

## Acceptance checks

- [x] On the Ally step, the owner sees the transcript segments as a selectable list (speaker + text), all selected by default, with a sensible empty-state when there are none. (`AllyEvidenceSelector.tsx`; unit-covered.)
- [x] "Preview what my ally would see" promotes the selected segments and opens the preview dialog with the allowlisted packet (no `UNKNOWN_EVIDENCE`); the preview button is disabled when nothing is selected. (e2e attack journey; `AllyEvidenceSelector.test.tsx`.)
- [x] De-selecting an excerpt removes it from the previewed packet's selected evidence; Share binds to exactly the previewed ids/version/hash and succeeds. (De-selection model: `selectedEvidenceIds` memo filters current segments minus `deselectedEvidenceIds`; `onShare` binds `preview.selectedEvidenceIds`/`caseVersion`/`packetHash`, re-validated server-side by `createAllyGrant`.)
- [x] The raw transcript is never sent to the ally (only the packet + selected excerpts) — unchanged from the existing contract. (e2e asserts "full transcript and other evidence are not included"; packet is the server allowlist.)
- [x] `apps/web/e2e/journey.spec.ts` re-enables the owner-side ally-preview assertion (dialog shows the claim under a "Caller claimed" label + a "Verification gap", never as an instruction); `npm run test:e2e` green across desktop + mobile-440.
- [x] Web unit suite green (was 201) + `npm run typecheck` clean; no API/contract change; no secrets or generated output committed.

## Verification evidence

- **Commands (all from repo root unless noted):**
  - `JAVA_HOME=/opt/homebrew/opt/openjdk@21 npm --workspace apps/web run test:e2e` → **8 passed** (4 specs × desktop 1280×800 + mobile-440). The attack journey now drives the full Ask my ally → promote → preview path and asserts the allowlisted packet ("Caller claimed" / "Account compromised" / "Verification gap") with the raw transcript excluded.
  - `npm --workspace apps/web run test` → **209 passed (23 files)** (+8 over the 201 baseline: 6 original DSN-033 selector tests + 2 new cap-boundary tests).
  - `npm run typecheck` → clean across `@dsn/contracts`, `@dsn/api`, `@dsn/web`.
- **Changed paths:** `apps/web/src/AllyEvidenceSelector.tsx` (new), `apps/web/src/AllyEvidenceSelector.test.tsx` (new), `apps/web/src/App.tsx` (Ally step), `apps/web/e2e/journey.spec.ts` (re-enabled preview assertion), `project/decisions/0016-ally-preview-promotes-selected-evidence.md` (new). No `apps/api` or `packages/contracts` edit.
- **Review:** independent adversarial code-review run (did not run e2e). Confirmed the de-selection model, promote-then-preview sequencing, disabled-when-empty, and the preview→grant snapshot binding are sound; no contract drift; no secret/path leak; unit tests meaningful. Findings applied:
  - **MEDIUM (fixed):** a transcript with >10 segments defaulted to selecting all, exceeded the server's `.max(10)` cap, and dead-ended at preview with a false "Nothing was changed" message after silently promoting 11+ evidence docs. Fixed with a client-side `MAX_ALLY_EVIDENCE = 10` cap: Preview is disabled with a caution callout over the cap, and the handler guards the cap before promoting (no side effect). Two unit tests pin the boundary.
  - **LOW/MEDIUM (recorded):** promote-on-preview persists previewed-but-unshared excerpts under `selected-7d` retention — a conscious owner-data retention coupling, documented in decision 0016.
  - **LOW (no action):** `deselectedEvidenceIds` can grow unbounded but never affects correctness (the memo filters by current segments); `AllySharePreview` `stale`/`onRefresh` not wired at this call site — cosmetic, Share re-validates version+hash regardless.
- **Additional bug found during e2e integration (fixed):** the preview endpoint returns `packetContent` (`apps/api/src/ally.ts` `previewAllyPacket`), but `App.tsx` read `result.packet` — a latent field-name mismatch that predates DSN-033 and only became reachable once promotion was wired, crashing `AllySharePreview` on `packet.selectedEvidence`. TypeScript did not catch it because the response was cast via the request generic. Fixed by reading `packetContent` and mapping it to the dialog's `packet`. This is why the earlier DSN-032 "8/8" run passed without the preview assertion present.
- **Commit:** (recorded at integration below.)
