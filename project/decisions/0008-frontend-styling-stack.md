# 0008: Frontend styling stack (Tailwind + PostCSS + Radix primitives + CSS-variable tokens)

- **Status:** Accepted
- **Date:** 2026-10-07
- **Owners:** DSN-018 implementer
- **Related task:** DSN-018 (accessibility hardening deferred to DSN-019)
- **PRD references:** AI Builder Cup Core MVP; Cup-ready clean demo; persistent simulated labelling
- **Supersedes:** None
- **Superseded by:** None

## Context

The web shell is unstyled. The founder approved a full styled, guided
journey for the local demo. Accessibility hardening (contrast audit, focus and
keyboard polish) is deliberately deferred to DSN-019, so this decision only
needs sensible defaults. The safety pause must read as prominent without
looking like a scam verdict, and simulated behavior must stay persistently
labelled.

## Decision

- Tailwind CSS 3.4 + PostCSS + autoprefixer for utility styling. Tailwind 4
  was not used: it moves to a separate `@tailwindcss/postcss` plugin and CSS-first
  config, which this setup does not adopt.
- `@radix-ui/react-dialog` and `@radix-ui/react-collapsible` as unstyled
  behavior primitives (focus trapping, ARIA wiring) for modals and disclosures.
- Design tokens live in one place, `apps/web/src/ui/tokens.css`, as CSS custom
  properties on `:root` (neutral ramp, `--color-primary`, `--color-pause`
  (warm amber, not red), `--color-safe`, `--color-info`, `--color-simulated`,
  spacing, radii, shadows). `tailwind.config.js` maps theme keys to these
  variables. Note that `theme.extend.spacing` overrides Tailwind's numeric keys
  1-6, 8 and 10 with the token scale.
- System font stack only; no web-font dependency or network call.
- Color never carries state alone; components add a label or shape.

## Consequences

- New dependencies (`tailwindcss`, `postcss`, `autoprefixer`, two Radix
  packages) under serialized ownership of `package.json` and the lockfile.
- The CSS pipeline for a production build is part of the blocked deploy path;
  `tsc` typecheck is not evidence it works (the `build` script is `tsc` only).
- Token values are provisional pending the DSN-019 contrast audit.

## Alternatives considered

### Plain CSS

Rejected: slower to polish a full styled journey and no shared utility
vocabulary.

### Full component library

Rejected: imposes its own design language and brings the largest dependency
tree.

## Verification

`npm --workspace apps/web run typecheck` clean. `npm run dev:web` serves
`index.html` and `/src/index.css` (200) with the tokens and Tailwind base layer
compiled. Lockfile scanned: every `resolved` URL is `registry.npmjs.org` (other
than the three workspace links) and no internal-host matches.
