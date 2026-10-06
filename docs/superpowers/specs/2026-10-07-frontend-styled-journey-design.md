# Frontend styled journey — design spec

- **Status:** Draft for review (revised after spec review, 2026-10-07)
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
single-scroll serif page. `App.tsx` stacks all seven journey screens at once.

**`ILLEGAL_TRANSITION` — corrected diagnosis (spec review, CRITICAL 1).** Step
navigation (`App.tsx:118`, `onClick={() => setStep(name)}`) is pure client
state; it fires no API call and therefore cannot cause `ILLEGAL_TRANSITION`. The
error comes from **action buttons whose legality depends on the case `phase`**,
not from navigating. The dominant path: `VerifyPanel`'s "Verify with Demo Bank"
calls `POST cases/:id/verify` → `verifyWithDemoBank` → `transition(phase,
'Verify')`, but `ALLOWED_TRANSITIONS` has edges to `Verify` only from `Check`
and `Pause` (not `Observe`). Fact extraction does **not** change phase; only a
payment assessment moves a case out of `Observe`. So verifying before submitting
the simulated transfer throws `ILLEGAL_TRANSITION`, and `ActionConsole` actively
invites this by offering "Verify officially" from a quiet `Observe` case. The
fix must therefore gate **actions by phase**, not steps by prerequisite.

The backend composition, API contracts, state machine, and safety behavior are
complete and working. Only the **presentation layer** and the **guided flow**
are missing. The founder approved building the full styled journey toward the
wireframe gallery, treating those frames as a *guiding block* (same hierarchy,
copy, action order — not pixel-identical spacing/palette), and de-prioritized
accessibility: keep only the a11y free with the chosen stack now; defer the rest
to DSN-019.

## Goals

1. A presentable, guided three-minute Cup demo that answers, in order, **What
   action is pending? Why slow down? What can I do now?** — not a scam-score
   dashboard, not a chatbot.
2. A focused flow: one active screen at a time with a progress rail, and
   **phase-gated actions** so no interaction yields `ILLEGAL_TRANSITION`.
3. A reusable design-token system and small shared UI primitive layer so all
   screens read as one product.
4. Responsive layout per the README (wide: source context beside the action;
   narrow ~440px: single reading path with actions stacked).
5. Preserve every API contract, the state machine, the screen component **prop
   interfaces**, and all mandated safety copy/labels.

## Non-goals (out of scope here)

- The PRD's formal accessibility acceptance (WCAG AA contrast audit, full
  keyboard sweep, screen-reader name audit, 200% text-scaling verification,
  no-color-alone review, automated a11y tests) — **owned by DSN-019**. This task
  keeps only no-cost a11y (semantic HTML, text labels, `focus-visible`, Radix's
  built-in dialog/disclosure behavior) and does **not** claim the a11y checks.
- Cloud deploy, production web/Firebase config, live Gemini — remain blocked
  (DSN-014 sub-gate 4).
- Automated Playwright e2e — remains `test.skip` (DSN-014 sub-gate 1).
- Any change to API **routes**, request/response shapes, the state machine, the
  retention/scheduler path, or the fake-Gemini double. (The verify fix changes
  only *when the client enables an existing action*, not any route or machine.)
- The two-hop `actVerify` re-wire (noted under Verify fix as a future option).
- New product behavior, risk percentages, mental-state labels, real payment or
  reporting actions, brand/logo finalization.

## Styling stack (decision 0008)

- **Tailwind CSS + PostCSS** as the styling foundation (utilities + a theme
  encoding the design tokens). Bespoke screens, no imposed design language.
- **A minimal set of `@radix-ui/react-*` primitives**: `Dialog` (ally-share
  preview) and `Collapsible` (expandable source detail). **No `AlertDialog`** —
  see Error handling / Decision below.
- **System font stack** — no web-font dependency or network call.
- New dependencies: `tailwindcss`, `postcss`, `autoprefixer`,
  `@radix-ui/react-dialog`, `@radix-ui/react-collapsible`. Recorded in decision
  0008; root/web `package.json` + lockfile edited under serialized integrator
  ownership; lockfile scanned for internal hosts as in DSN-014.

## Design tokens

Tailwind theme values backed by CSS custom properties on `:root`
(`apps/web/src/ui/tokens.css` + Tailwind config, one place so DSN-019 can retune
palette/contrast without touching components):

- **Color:** neutral surface/text ramp; one calm **primary**; semantic tokens —
  `pause` (prominent but deliberately **not** red/alarmist — a safety pause, not
  a scam verdict), `safe`, `info`, and a persistent muted `simulated` badge.
  No state carried by color alone (shape/label too); full contrast tuning is
  DSN-019 but defaults must be sensible.
- **Typography:** system font stack; small type scale (display/heading/body/caption).
- **Spacing/radius/shadow:** one spacing scale, soft radii, low-elevation card shadows.

## Architecture

### Shared UI layer — `apps/web/src/ui/`

Small single-purpose primitives consumed by every screen; minimal explicit props:

- `Button` — variants `primary | secondary | pause | cancel | ghost`; sizes; disabled.
- `Card` — surface container with optional title/footer.
- `Field` — label + control + hint/error wrapper (wraps `input`/`select`).
- `Badge` — persistent `Simulated`, `Controlled transcript`, and provenance
  chips (`Caller claimed`, `User confirmed`, `User corrected`, `Unknown`,
  `Source not retained`).
- `Callout` — info/caution/error block (replaces raw error text).
- `StepRail` — progress rail; renders steps as current/available/locked with a
  short locked-reason. (Guided-flow UX; it is **not** the `ILLEGAL_TRANSITION`
  fix — that is action gating.)
- `ActionBar` — groups primary + secondary actions with correct hierarchy.
- Radix wrappers: `Dialog`, `Disclosure` (Collapsible).

### Case loading on mount — `App.tsx` (CRITICAL 2 fix)

Add a `useEffect` that fetches the case when `caseId` is present (from URL
deep-link or reload) and populates `caseView` before gating decisions are made.
Today `caseView` is only set inside action handlers, so a reload strands the UI.
Gating must **degrade gracefully**: never lock a step/action forward purely
because ephemeral state was lost. Because a case cannot be created without a
saved plan (`POST cases` throws `PLAN_REQUIRED`), the existence of a loaded case
*implies* a plan existed — so `planSaved` only needs to gate starting a new
session, and re-saving a plan is an idempotent `PUT` (no GET plan route is
added). `factsExtracted`, `paymentState`, `phase`, and recovery derive from the
fetched `caseView`.

### Phase-gated actions + step availability — `apps/web/src/journey.ts` (new, pure)

Pure, React-free, unit-testable:

```
type JourneyState = {
  role: 'owner' | 'ally' | null;
  planSaved: boolean;        // ephemeral; gates only "start new session"
  caseId: string;
  phase?: Phase;             // from caseView.phase — REQUIRED for action gating
  factsExtracted: boolean;   // derived from caseView.facts
  paymentState?: PaymentProjection['paymentState'];
  hasVerification: boolean;  // derived from caseView
  recoveryEntered: boolean;  // phase === 'Recover' or caseView.recovery
  hasConfirmedFacts: boolean;
};

// Guided-flow step availability (UX only):
function journeySteps(s: JourneyState): { step: Step; state: 'current'|'available'|'locked'; reason?: string }[];
function initialStep(s: JourneyState): Step;

// Action legality (the real ILLEGAL_TRANSITION guard):
function canVerify(s: JourneyState): { allowed: boolean; reason?: string };
```

- **`canVerify`** = `phase ∈ {Check, Pause}` OR `hasVerification`. When `Observe`
  (or otherwise disallowed), the Verify affordance is **disabled with guidance**:
  "Submit the simulated transfer to enable official verification." This removes
  the dominant `ILLEGAL_TRANSITION` path without any route or state-machine
  change. `ActionConsole`'s "Verify officially" from `Observe` is likewise gated
  to guidance.
- **`cancel`/`continue`** are illegal only from `Resolve`, and are already
  guarded by `PAYMENT_FINALIZED` before the transition — low risk; do **not**
  over-gate them. (Continue keeps its existing, tested consequence
  acknowledgment-checkbox gate.)
- Step availability (UX rail): Ally role → only the `Ally` path; owner → `Plan`
  always; `Session` needs `planSaved`; `Decision` needs `caseId`; `Verify`/`Ally`
  need `factsExtracted`; `Recovery` once a payment exists or recovery entered;
  `Evidence` once `hasConfirmedFacts`. Locked steps render disabled with a
  reason; `initialStep` auto-advances to the current actionable step.

Exact predicates/`Phase` values are finalized against `transitions.ts` /
`App.tsx` in the plan; `journey.ts` is the single source of truth.

### Screens — `*.tsx` (seven journey steps, ten screen/panel components)

Restyle internals/markup of `PlanScreen`, `SessionScreen`, `DecisionMap`,
`PaymentPanel`, `ActionConsole`, `VerifyPanel`, `AllySharePreview`, `AllyScreen`,
`RecoveryScreen`, `EvidenceScreen` using the shared UI layer. **External prop
interfaces unchanged** (all take injected callbacks + data props; verified in
review). `AllySharePreview` is wrapped in a Radix `Dialog` **at App level**
(`<Dialog open={!!preview} onOpenChange=…>` around the existing conditional
render), with an injected visually-hidden `Dialog.Title` to satisfy Radix;
components stay bare so their isolation tests keep their `role`/structure
assumptions. Source detail uses `Disclosure` (Collapsible).

## Data flow

Unchanged. Browser → `api-client` → `/api/v1/**` (via Vite proxy to the dev API)
→ fake Gemini + Firestore emulator. No browser-side Firestore/Gemini. The
restyle touches rendering + action-enablement only; all `api.command`/`get`/
`download` calls, idempotency handling, and the `run()` wrapper stay.

## Error handling / Decision: no AlertDialog

Keep the `run()` wrapper; surface failures via `Callout` instead of raw
`<p role="alert">`. **Decision (spec review MEDIUM 3):** do **not** add a Radix
`AlertDialog` confirmation to Cancel. Cancel is the *safe* action and must stay
one tap; `ActionConsole.test.tsx` asserts `onCancel` fires immediately and
Cancel/Verify stay enabled. The only consequential confirmation — Continue past
an unverified pre-OTP action — already exists as the tested acknowledgment
checkbox and is preserved as-is. This both honors the safety model and keeps
those behavioral tests green.

## Responsive & layout

Tailwind breakpoints. Wide (≥ ~1024px): two-column where the frame calls for it
(transcript + Decision Map beside payment/action). Narrow (~440px): single
reading path — pending status, ≤3 cited reasons, primary action, other actions
stacked; source detail expands via `Disclosure` without hiding correction or
Continue. Recovery places the simulated Demo Bank route and the real 1930 route
as **equal-weight stacked cards at the same heading level**
(`RecoveryScreen.test.tsx:33` asserts heading parity — preserve it).

## Testing

- Existing web vitest suite (**109 passing**, 10 files) must stay green. Most
  tests use `getByRole`/`getByText` and are robust; dropping AlertDialog keeps
  the `ActionConsole` behavioral tests valid. Update only assertions coupled to
  pre-restyle markup, preserving behavioral intent and **every safety-copy
  assertion verbatim**. Preserve `RecoveryScreen.test.tsx:33` heading parity.
- New `journey.test.ts`: unit tests for `journeySteps`/`initialStep`/`canVerify`
  — owner progression, ally path, locked-with-reason, and the `Observe`→Verify
  guard (regression for the real `ILLEGAL_TRANSITION`).
- Typecheck clean across all three workspaces. **Note:** `tsc -p tsconfig.json`
  typechecks TS only; CSS/Tailwind is consumed by Vite at dev/preview, and the
  production CSS build is part of the blocked deploy path — so "typecheck clean"
  is **not** evidence the production CSS pipeline works.
- Visual verification via `npm run dev:api` + `npm run dev:web`: walk the owner
  journey; confirm styling, responsive behavior, the persistent Simulated/pre-OTP
  banner, and that no interaction (including Verify from a quiet case) yields
  `ILLEGAL_TRANSITION`.
- No automated a11y tests here (DSN-019).

## Safety invariants (must hold after restyle)

- Persistent `Simulated` on Demo Bank/transfer/local acknowledgements
  (`App.tsx:93` + ActionConsole/PaymentPanel/VerifyPanel/EvidenceScreen/
  RecoveryScreen); `Controlled transcript` on session input
  (`SessionScreen.tsx:47,52`); `before you enter an OTP` (`App.tsx:97`); 1930 +
  cybercrime.gov.in as real routes never filed on the user's behalf (`App.tsx:98`,
  `RecoveryScreen.tsx:91-94`).
- Provenance states remain visually distinct: `Caller claimed`, `User confirmed`,
  `User corrected`, `Unknown`, `Source not retained` (`DecisionMap.tsx:37-45,
  135,144`). A confirmed transcript fact is not a verified bank fact; proposed
  payee/amount never shown as actually paid.
- Equal visual weight for the simulated Demo Bank route and the real 1930 route
  on recovery.
- No scam probability, mental-state label, or fabricated authority outcome. Ally
  view shows only the minimum packet; sharing stays an explicit owner grant.

## Risks

- **Behavior scope:** the only non-presentation change is action *enablement*
  (`canVerify`) + an on-mount fetch — no routes/machine touched. Diff review
  targets any accidental logic change.
- **Test churn:** keep behavioral + safety-copy assertions; run the suite per
  screen.
- **Dependency footprint:** minimal (Tailwind + 2 Radix primitives); decision
  0008 + lockfile host scan.

## Verification

Suite green (109 + new `journey.test.ts`), typecheck clean, `git diff --check`
clean, hygiene grep clean, and a recorded manual walkthrough of the styled owner
journey on the local harness with no `ILLEGAL_TRANSITION` from any interaction.
Nothing deployed; no cloud resource; no real Gemini call.
