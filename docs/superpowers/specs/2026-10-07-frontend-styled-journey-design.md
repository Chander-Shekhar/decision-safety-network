# Frontend styled journey — design spec

- **Status:** Draft for review
- **Date:** 2026-10-07
- **Owner:** Integrator (DSN-018)
- **Related tasks:** DSN-018 (this work), DSN-019 (accessibility, deferred/backlog)
- **Related decision:** `project/decisions/0008-frontend-styling-stack.md` (styling stack)
- **PRD references:** Part I locked; `docs/design/wireframes/README.md` (founder-approved UI direction, 3 Oct 2026); Core MVP implementation plan Task 12 (DSN-014 composition)
- **Builds on:** DSN-014 local e2e harness (decision 0007)

## Context

The local end-to-end demo runs (DSN-014 + decision 0007) but ships an
**unstyled** React shell: there is no CSS anywhere in `apps/web` (no stylesheet,
no Tailwind, no `className` usage), so the browser default stylesheet renders a
single-scroll serif page. `App.tsx` stacks all seven journey screens at once and
exposes the steps as a flat `<ol>` of buttons that are freely clickable
regardless of case state; clicking a step whose backend prerequisite is missing
fires a state-machine transition that is correctly rejected with
`ILLEGAL_TRANSITION`, leaving the user with no guidance to the right next action.

The backend composition, API contracts, state machine, and safety behavior are
complete and working. Only the **presentation layer** and the **guided flow**
are missing. The founder has approved building the full styled journey toward
the wireframe gallery, treating those frames as a *guiding block* (same
hierarchy, copy, and action order — not pixel-identical spacing/palette), and
has de-prioritized accessibility: keep only the a11y that is free with the
chosen stack now; defer everything that costs real effort to DSN-019.

## Goals

1. A presentable, credible, guided three-minute Cup demo that answers, in order,
   **What action is pending? Why slow down? What can I do now?** — not a
   scam-score dashboard, not a chatbot.
2. A focused flow: one active screen at a time with a progress rail; steps gated
   by real case/role state so the user never triggers `ILLEGAL_TRANSITION` by
   navigating.
3. A reusable design-token system and small shared UI primitive layer so all
   seven screens read as one product.
4. Responsive layout per the README (wide: source context beside the action;
   narrow ~440px: single reading path with actions stacked).
5. Preserve every API contract, the state machine, the screen component **prop
   interfaces**, and all mandated safety copy/labels.

## Non-goals (explicitly out of scope here)

- The PRD's formal accessibility acceptance (WCAG AA contrast audit, full
  keyboard sweep, screen-reader name audit, 200% text-scaling verification,
  no-color-alone review, automated a11y tests) — **owned by DSN-019**. This task
  keeps only no-cost a11y (semantic HTML, text labels, `focus-visible`, Radix's
  built-in dialog/disclosure behavior) and does **not** claim the a11y checks.
- Cloud deploy, production web/Firebase config, live Gemini — remain blocked
  (DSN-014 sub-gate 4; unchanged here).
- Automated Playwright e2e — remains `test.skip` (DSN-014 sub-gate 1).
- Any change to API routes, request/response shapes, the state machine, the
  retention/scheduler path, or the fake-Gemini double.
- New product behavior, risk percentages, mental-state labels, real payment or
  reporting actions, brand/logo finalization.

## Styling stack (decision 0008)

- **Tailwind CSS + PostCSS** as the styling foundation (utility classes + a
  theme that encodes the design tokens). Bespoke screens, no imposed design
  language.
- **A small set of `@radix-ui/react-*` primitives** for interaction- and
  focus-sensitive surfaces: `Dialog` (ally-share preview), `AlertDialog`
  (cancel/irreversible confirmation), `Collapsible` (expandable source detail).
  These give correct focus/escape/aria behavior for free.
- **System font stack** — no web-font dependency or network call.
- New dependencies (dev/runtime as appropriate): `tailwindcss`, `postcss`,
  `autoprefixer`, `@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog`,
  `@radix-ui/react-collapsible`. Recorded in decision 0008; root/web
  `package.json` + lockfile edited under serialized integrator ownership.

## Design tokens

Encoded as Tailwind theme values backed by CSS custom properties on `:root`:

- **Color:** neutral surface/text ramp; one calm **primary**; semantic tokens —
  `pause` (prominent but deliberately **not** red/alarmist; this is a safety
  pause, not a scam verdict), `safe`, `info`, and a persistent muted
  `simulated` badge color. No state is carried by color alone (shape/label too);
  full contrast tuning is DSN-019 but defaults should be sensible.
- **Typography:** system font stack; a small type scale (display, heading, body,
  caption).
- **Spacing/radius/shadow:** one spacing scale, soft radii, low-elevation
  shadows for cards.

Tokens live in one place (`apps/web/src/ui/tokens.css` + Tailwind config) so
DSN-019 can retune palette/contrast without touching components.

## Architecture

### Shared UI layer — `apps/web/src/ui/`

Small, single-purpose, independently understandable primitives consumed by every
screen; external props minimal and explicit:

- `Button` — variants: `primary | secondary | pause | cancel | ghost`; sizes;
  disabled state.
- `Card` — surface container with optional title/footer.
- `Field` — label + control + hint/error wrapper (wraps `input`/`select`).
- `Badge` — e.g. the persistent `Simulated`, `Controlled transcript`, provenance
  state chips (`Caller claimed`, `Source excerpt`, `User corrected`, `Unknown`,
  `Source not retained`).
- `Callout` — info/caution/error message block (replaces raw error text).
- `StepRail` — progress rail; renders steps with current/available/locked state
  and a short locked-reason.
- `ActionBar` — groups the primary + secondary actions with correct hierarchy
  (used at the Pause/decision moment).
- Radix wrappers: `Dialog`, `ConfirmDialog` (AlertDialog), `Disclosure`
  (Collapsible).

### App shell — `App.tsx`

- Header: product title + the **persistent** banner carrying `Simulated` and
  `before you enter an OTP` copy and the real-route disclaimer (unchanged text).
- `StepRail` below the header; one `main` content region showing the active
  screen only.
- Styling and the step-gating wiring are added in `App.tsx`; its existing state,
  handlers, API calls, and the role branching are **preserved**.

### Step-gating — `apps/web/src/journey.ts` (new, pure)

A pure function isolates the IA fix and is unit-testable without React:

```
type JourneyState = {
  role: 'owner' | 'ally' | null;
  planSaved: boolean;
  caseId: string;
  factsExtracted: boolean;
  paymentState?: PaymentProjection['paymentState'];
  recoveryEntered: boolean;
};
type StepStatus = { step: Step; state: 'current' | 'available' | 'locked'; reason?: string };
function journeySteps(s: JourneyState): StepStatus[];
function initialStep(s: JourneyState): Step; // the current actionable step on load
```

Rules (derived from role + case state; locked steps render disabled with a
"do X first" reason rather than firing a rejected transition):

- Ally role: only the `Ally` (shared-case) path is available.
- Owner: `Plan` always available; `Session` requires a saved plan; `Decision`
  requires a `caseId`; `Verify`/`Ally` require extracted facts; `Recovery`
  available once a payment exists or recovery was entered; `Evidence` available
  once there are confirmed facts. (Exact predicates finalized against the
  existing handlers in the plan; the function is the single source of truth.)

### Screens — `*.tsx` (seven journey steps, ten screen/panel components)

Restyle internals/markup of `PlanScreen`, `SessionScreen`, `DecisionMap`,
`PaymentPanel`, `ActionConsole`, `VerifyPanel`, `AllySharePreview`, `AllyScreen`,
`RecoveryScreen`, `EvidenceScreen` using the shared UI layer. **External prop
interfaces are unchanged.** `AllySharePreview` moves into `Dialog`; cancel/
irreversible actions use `ConfirmDialog`; source detail uses `Disclosure`.

## Data flow

Unchanged. Browser → `api-client` → `/api/v1/**` (relative, via Vite proxy to
the dev API) → fake Gemini + Firestore emulator. No browser-side Firestore or
Gemini. The restyle touches rendering only; all `api.command`/`api.get`/
`api.download` calls, idempotency handling, and the `run()` error wrapper stay.

## Error handling

Keep the `run()` wrapper. Surface failures via `Callout` (styled) instead of raw
`<p role="alert">`. Step-gating prevents most invalid transitions pre-emptively;
any backend rejection still shows "Request failed (CODE). Nothing was changed."

## Responsive & layout

Tailwind breakpoints. Wide (≥ ~1024px): two-column where the frame calls for it
(transcript + Decision Map beside payment/action). Narrow (~440px): single
column reading path — pending status, ≤3 cited reasons, primary action, other
actions stacked below; source detail expands via `Disclosure` without hiding
correction or Continue. Recovery places the simulated Demo Bank route and the
real 1930 route as equal-weight stacked cards.

## Testing

- Existing web vitest suite (**109 passing** across 10 files) must stay green.
  Several `*.test.tsx` assert on current markup/text; update assertions that
  couple to pre-restyle markup, preserving their behavioral intent and all
  safety-copy assertions. No safety-copy string may be removed.
- New `journey.test.ts`: unit tests for `journeySteps`/`initialStep` covering
  owner progression, ally path, and locked-with-reason cases.
- Typecheck clean across all three workspaces.
- Visual verification via `npm run dev:api` + `npm run dev:web`: walk the
  owner journey and confirm the flow, styling, responsive behavior, persistent
  Simulated/pre-OTP banner, and that no navigation yields `ILLEGAL_TRANSITION`.
- No automated a11y tests here (DSN-019).

## Safety invariants (must hold after restyle)

- Persistent `Simulated` on Demo Bank/transfer/local acknowledgements;
  `Controlled transcript` on session input; `before you enter an OTP` copy at the
  pause; 1930 + cybercrime.gov.in described as real routes never filed on the
  user's behalf.
- Provenance states remain visually distinct; a confirmed transcript fact is not
  a verified bank fact; proposed payee/amount never presented as actually paid.
- No scam probability, mental-state label, or fabricated authority outcome.
- Ally view shows only the minimum packet; sharing stays an explicit owner grant.

## Risks

- **Test churn:** markup-coupled assertions break on restyle. Mitigation: update
  per-screen, keep behavioral + safety-copy assertions, run the suite per screen.
- **Scope creep into behavior:** restyle must not alter handlers/contracts.
  Mitigation: prop interfaces frozen; diff review targets logic changes.
- **Dependency footprint:** new build deps. Mitigation: minimal Radix primitive
  set + Tailwind only; recorded in decision 0008; lockfile scanned for internal
  hosts as in DSN-014.

## Verification

Suite green (109 + new journey tests), typecheck clean, `git diff --check`
clean, hygiene grep clean, and a recorded manual walkthrough of the styled
owner journey on the local harness with no `ILLEGAL_TRANSITION` from navigation.
Nothing deployed; no cloud resource; no real Gemini call.
