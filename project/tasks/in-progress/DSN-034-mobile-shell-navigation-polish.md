# DSN-034: Mobile app shell, burger-menu navigation, and consolidated Settings

- **Scope:** core
- **Priority:** P1
- **Owner:** Orchestrator (solo owner — claim + implement + integrate per WORKFLOW "Solo owner")
- **Branch/worktree:** `task/DSN-034-mobile-shell-nav` (no separate worktree; solo on `apps/web`)
- **Owned paths:** `apps/web/src/**`, `apps/web/index.html`, `project/tasks/in-progress/DSN-034-*.md`, `docs/superpowers/specs/2026-10-15-mobile-shell-nav-design.md`. Not owned / untouched: `apps/api/**`, `packages/contracts/**` (no contract change), `apps/android/**` (DSN-025 parked here — its web capture bridge is preserved).
- **Dependencies:** DSN-018 (styled journey), DSN-022 (declutter), DSN-023 (first-run), DSN-030 (transcript input), DSN-033 (ally evidence) — all done. Decision 0010 (disclosure policy) governs the copy pass.
- **PRD references:** Core MVP UI; honesty/disclosure (reconciled by decision 0010); wireframe README intent (focused case flow).
- **Decision references:** 0010 (single consolidated disclosure + light point-of-use indicator; supersedes scattered "simulated/prototype/synthetic" labels).
- **Started:** 2026-10-15
- **Last updated:** 2026-10-15

## Outcome

The web app presents as a mobile-friendly app: a centered single-column shell with a burger-menu drawer (Home · Cases · Settings · About this demo), a first-run Home that invites the user to Settings, one consolidated Settings surface (essentials + an Advanced disclosure) with a sample Safety Ally already present, a session input switcher (Live call · Paste transcript · Upload recording) that preserves the real capture path, and demo-ish caveat clutter replaced by a single About disclosure plus light point-of-use `illustrative` tags. No backend/contract change.

## Boundaries

- Included: app shell + drawer nav; top-level view routing (home/cases/settings/about) alongside the in-case flow; first-run Home; consolidated Settings merging first-run Setup + Safety Plan essentials, with Advanced holding retention/share-fields/export/threshold; sample ally display; three-mode session input switcher; copy pass removing scattered demo caveats in favor of one About disclosure + point-of-use `illustrative` indicators; auto owner sign-in with a drawer "Open ally view" switch.
- Excluded: any `apps/api`/`packages/contracts` change; renaming the fictional "Demo Bank" institution; real cross-device ally pairing changes (sample ally is a ready-looking presence; real pairing path remains); new product capabilities beyond the approved vision.

## Acceptance checks

- [ ] Fresh owner lands on a first-run Home that names it as a first run and links to Settings; no forced blocking wizard. — `npm --workspace apps/web test`
- [ ] Burger drawer navigates Home/Cases/Settings/About; focus-trapped and keyboard-operable. — vitest + manual
- [ ] Settings shows essentials (call listening, Safety Ally with a sample ally, protected accounts, allow-processing) and an Advanced disclosure (retention, ally share fields, export, threshold); saving persists via `PUT plan`. — vitest
- [ ] Session input offers Live call / Paste transcript / Upload recording; paste + upload drive the existing segments→extract pipeline; the DSN-025 live capture bridge still works. — vitest + existing bridge tests green
- [ ] Exactly one consolidated disclosure (About this demo); no scattered "synthetic/prototype"; payment/bank/authority actions carry a light point-of-use `illustrative` tag. — vitest + grep
- [ ] `npm --workspace apps/web run typecheck` clean; `npm --workspace apps/web test` green; Playwright e2e updated and run (or skip documented).

## Verification evidence

- **Commits:** (recorded at handoff)
- **Integration commit:** Not integrated
- **Commands and results:** (recorded at handoff)
- **Post-integration verification:** Not run
- **Changed paths:** (recorded at handoff)
- **Limitations or skipped checks:** (recorded at handoff)

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Implement per the approved design/spec, run checks, self-review, integrate to `main`.
- **Unresolved issues:** None recorded.
