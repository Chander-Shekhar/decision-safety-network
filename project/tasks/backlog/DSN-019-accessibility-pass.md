# DSN-019: Frontend accessibility acceptance pass

- **Scope:** core (frontend accessibility)
- **Priority:** P2 (deferred from DSN-018 by founder direction, 2026-10-07 — a11y not top priority now)
- **Owner:** Unassigned (backlog)
- **Branch/worktree:** TBD on claim
- **Owned paths:** `apps/web/src/**` (shared `ui/` layer + screens), `apps/web/src/ui/tokens.css` (palette/contrast retune lives in one place)
- **Dependencies:** DSN-018 (styled journey — provides the token layer and shared primitives this pass audits)
- **PRD references:** Part I accessibility acceptance; `docs/design/wireframes/README.md`
- **Decision references:** 0008 (styling stack — Tailwind + Radix; tokens as CSS custom properties so palette/contrast retune without touching components)
- **Started:** —
- **Last updated:** 2026-10-07
- **Status:** `backlog` — created to hold the accessibility work explicitly deferred out of DSN-018.

## Outcome

The styled journey meets the PRD's formal accessibility acceptance: WCAG AA color-contrast, a full keyboard sweep (no traps, logical focus order, visible focus throughout), screen-reader accessible-name audit of every control, 200% text-scaling without clipping/overlap, no-state-by-color-alone verification, and automated a11y tests wired into the web suite. DSN-018 deliberately keeps only the no-cost a11y (semantic HTML, text labels, `focus-visible`, Radix built-in dialog/disclosure behavior) and does **not** claim these checks.

## Boundaries

- Included: contrast tuning of the token palette (`tokens.css`), keyboard/focus audit + fixes, SR name audit + fixes, 200%-scaling layout fixes, no-color-alone review, an automated a11y test harness (e.g. axe/jest-axe equivalent for Vitest) and its CI wiring.
- Excluded: new product behavior, route/state-machine/contract changes, cloud deploy, any change to mandated safety copy (preserve verbatim).

## Acceptance checks

- [ ] WCAG AA contrast verified across tokens (text, interactive, pause/safe/info/simulated states).
- [ ] Full keyboard operability: no traps, logical order, visible `focus-visible` on every interactive element incl. Radix Dialog/Collapsible.
- [ ] Accessible-name audit: every button/field/badge/dialog has a correct SR name; the injected hidden Dialog.Title reads sensibly.
- [ ] 200% text scaling: no clipping or overlap on wide and ~440px layouts.
- [ ] No state conveyed by color alone (shape/label/icon accompanies every color cue).
- [ ] Automated a11y tests added and green in the web suite; typecheck clean; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded.

## Blocker or deferral

Deferred at creation: founder set a11y below the styled-journey demo for now. Resume condition: founder prioritizes the accessibility pass, or the Cup-ready gate requires it. Remaining risk until resumed: the demo may not meet WCAG AA / keyboard / SR / scaling acceptance; DSN-018 ships sensible defaults but makes no formal a11y claim.

## Handoff

Claim after DSN-018 integrates. Start from the DSN-018 token layer (`apps/web/src/ui/tokens.css`) and shared primitives; retune palette/contrast there rather than per component.
