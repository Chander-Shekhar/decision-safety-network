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

- [ ] On the Ally step, the owner sees the transcript segments as a selectable list (speaker + text), all selected by default, with a sensible empty-state when there are none.
- [ ] "Preview what my ally would see" promotes the selected segments and opens the preview dialog with the allowlisted packet (no `UNKNOWN_EVIDENCE`); the preview button is disabled when nothing is selected.
- [ ] De-selecting an excerpt removes it from the previewed packet's selected evidence; Share binds to exactly the previewed ids/version/hash and succeeds.
- [ ] The raw transcript is never sent to the ally (only the packet + selected excerpts) — unchanged from the existing contract.
- [ ] `apps/web/e2e/journey.spec.ts` re-enables the owner-side ally-preview assertion (dialog shows the claim under a "Caller claimed" label + a "Verification gap", never as an instruction); `npm run test:e2e` green across desktop + mobile-440.
- [ ] Web unit suite green (was 201) + `npm run typecheck` clean; no API/contract change; no secrets or generated output committed.

## Verification evidence

_(filled at completion)_
