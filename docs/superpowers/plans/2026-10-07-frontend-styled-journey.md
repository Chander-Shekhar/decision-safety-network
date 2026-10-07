# Frontend Styled Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the unstyled DSN-014 local journey shell into a presentable, guided, responsive demo with a design system and phase-gated actions that never produce `ILLEGAL_TRANSITION`.

**Architecture:** Add Tailwind + two Radix primitives and a small shared UI layer (`apps/web/src/ui/`). Isolate the guided-flow + action-legality logic in a pure, unit-tested `apps/web/src/journey.ts`. Restyle `App.tsx` and the ten screen/panel components using the UI layer, preserving every exported prop interface, API call, and safety string. The only non-presentation changes are an on-mount case fetch and gating the Verify action by `phase`.

**Tech Stack:** React 19.3, Vite 8.3, TypeScript (strict), Vitest 5.0.2, Tailwind CSS + PostCSS, `@radix-ui/react-dialog`, `@radix-ui/react-collapsible`, Firebase emulators + fake Gemini (local harness, decision 0007).

**Spec:** `docs/superpowers/specs/2026-10-07-frontend-styled-journey-design.md`

## Global Constraints

- Node `22.x` engine; local Node 24 emits EBADENGINE warnings only (decision 0007).
- No change to API **routes**, request/response shapes, the state machine (`apps/api/src/transitions.ts`), the retention/scheduler path, or the fake-Gemini double.
- Preserve **every exported screen prop interface verbatim** (listed per task). No breaking prop changes; optional additions only if a task says so.
- Preserve all safety copy verbatim: `Simulated`; `Controlled transcript`; `before you enter an OTP`; `1930`; `cybercrime.gov.in`; provenance labels `Caller claimed`, `User confirmed`, `User corrected`, `Unknown`, `Source not retained`. Demo Bank/transfer/local acknowledgements stay labelled Simulated; 1930 + cybercrime.gov.in are real routes never filed on the user's behalf.
- No scam probability, mental-state label, public blacklist, or fabricated authority outcome. Proposed payee/amount are never shown as actually paid. Ally view shows only the minimum packet.
- Browser never calls Firestore or Gemini directly; all data goes through `api-client` → `/api/v1/**`.
- Synthetic demo data only. Personal/no-reply git identity. Never commit secrets, local paths, or the absolute JDK path. Each commit subject begins with `DSN-018:`.
- `Verify` is legal only from `phase ∈ {Check, Pause}` (per `ALLOWED_TRANSITIONS`: `Observe` has no edge to `Verify`). Fact extraction does not change phase; only a payment assessment moves a case out of `Observe`.
- a11y acceptance is **out of scope** (DSN-019). Keep only free a11y (semantic HTML, text labels, `focus-visible`, Radix behavior). Do not claim the PRD a11y checks.

## Review Focus

- **Reload / deep-link to `/cases/:id`:** `caseView` must be fetched on mount or gating strands an advanced case as locked. → pinned in Task 4.
- **Verify from a quiet `Observe` case:** the dominant `ILLEGAL_TRANSITION`; the Verify action must be blocked with guidance and fire no API call. → pinned in Task 2 (`canVerify`) and Task 4 (App handler).
- **Backend still rejects a legal-looking action (e.g. `VERSION_CONFLICT`):** the `run()` wrapper must surface "Nothing was changed" via `Callout`, never crash the screen. → pinned in Task 4.
- **Ally role:** only the `Ally` path is available; no owner-only step or action is reachable. → pinned in Task 2 (`journeySteps` ally case).
- **Safety-copy / heading-parity survival across restyle:** every mandated string stays, and `RecoveryScreen` keeps Demo Bank and 1930 at the same heading level. → pinned in Tasks 5–8 (kept assertions) and Task 8 (heading parity).

---

### Task 0: Claim DSN-018, open DSN-019 backlog

**Files:**
- Create: `project/tasks/in-progress/DSN-018-frontend-styled-journey.md`
- Create: `project/tasks/backlog/DSN-019-accessibility-pass.md`

- [ ] **Step 1:** Write the DSN-018 in-progress record: scope (styling + guided flow + phase-gated actions), owner (integrator), branch `task/DSN-018-frontend-styled-journey`, owned paths (`apps/web/**`, `project/decisions/0008-*`, this plan/spec), dependencies (DSN-014), start time, acceptance checks copied from the spec's Verification section, status `in-progress`.
- [ ] **Step 2:** Write the DSN-019 backlog record: scope = the PRD a11y acceptance (WCAG AA contrast, full keyboard sweep, screen-reader name audit, 200% text-scaling verification, no-color-alone review, automated a11y tests), owner TBD, status `backlog`, note it owns the a11y checks DSN-018 explicitly does not claim, resume condition = DSN-018 merged.
- [ ] **Step 3: Commit.** `git add project/tasks/in-progress/DSN-018-frontend-styled-journey.md project/tasks/backlog/DSN-019-accessibility-pass.md && git commit -m "DSN-018: claim task; open DSN-019 a11y backlog"`

---

### Task 1: Styling stack + design tokens (decision 0008)

**Files:**
- Modify: `apps/web/package.json` (dependencies)
- Modify: root `package-lock.json` (via install)
- Create: `apps/web/tailwind.config.js`, `apps/web/postcss.config.js`
- Create: `apps/web/src/ui/tokens.css`, `apps/web/src/index.css`
- Modify: `apps/web/src/main.tsx` (import `./index.css`)
- Create: `project/decisions/0008-frontend-styling-stack.md`

**Interfaces:**
- Produces: a global stylesheet with Tailwind layers + CSS custom-property tokens on `:root`; Tailwind theme reads the tokens. Consumed by all later tasks.

- [ ] **Step 1:** `npm --workspace apps/web install -D tailwindcss postcss autoprefixer` and `npm --workspace apps/web install @radix-ui/react-dialog @radix-ui/react-collapsible`. (Pin the resolved versions in `package.json`.)
- [ ] **Step 2:** Create `postcss.config.js` (`export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`) and `tailwind.config.js` with `content: ['./index.html','./src/**/*.{ts,tsx}']` and a `theme.extend` mapping color/spacing/radius/font tokens to `var(--…)`.
- [ ] **Step 3:** Create `src/ui/tokens.css` defining `:root` custom properties: neutral surface/text ramp, `--color-primary`, `--color-pause` (prominent, not red), `--color-safe`, `--color-info`, `--color-simulated`, spacing scale, radii, shadows, system font stack. Create `src/index.css` with `@import './ui/tokens.css';` then `@tailwind base; @tailwind components; @tailwind utilities;`. Import `./index.css` at the top of `main.tsx`.
- [ ] **Step 4: Verify dev build processes CSS.** Run `npm --workspace apps/web run typecheck` → clean (CSS not typechecked). Start `npm run dev:web`, confirm the page loads with Tailwind base styles applied (no 500, CSS served). Stop it.
- [ ] **Step 5:** Write `project/decisions/0008-frontend-styling-stack.md` from `TEMPLATE.md`: Accepted; context (unstyled shell, founder-approved full styled journey, a11y deferred to DSN-019); decision (Tailwind + PostCSS + `@radix-ui/react-dialog` + `@radix-ui/react-collapsible`, system font, tokens in one place); alternatives rejected (plain CSS — slower to polish; full component library — imposes a design language, biggest dep tree); consequences (new deps under serialized ownership; CSS pipeline for production is part of the blocked deploy path — `tsc` typecheck is not evidence it works); verification (dev server renders styled; lockfile scanned).
- [ ] **Step 6: Lockfile host scan.** `grep -nE "repo.local|sfdc|salesforce|nexus" package-lock.json` → no hits (all `resolved` = registry.npmjs.org). 
- [ ] **Step 7: Commit.** `git add apps/web/package.json apps/web/tailwind.config.js apps/web/postcss.config.js apps/web/src/ui/tokens.css apps/web/src/index.css apps/web/src/main.tsx package-lock.json project/decisions/0008-frontend-styling-stack.md && git commit -m "DSN-018: add Tailwind + Radix styling stack and design tokens (decision 0008)"`

---

### Task 2: Pure journey logic — `journey.ts` (TDD)

**Files:**
- Create: `apps/web/src/journey.ts`
- Test: `apps/web/src/journey.test.ts`

**Interfaces:**
- Consumes: `Phase` from `../../../packages/contracts/src/case`.
- Produces:
  - `const STEPS` / `type Step` (the seven journey steps).
  - `interface JourneyState { role: 'owner'|'ally'|null; planSaved: boolean; caseId: string; phase?: Phase; factsExtracted: boolean; paymentExists: boolean; hasVerification: boolean; recoveryEntered: boolean; hasConfirmedFacts: boolean }`
  - `interface StepStatus { step: Step; available: boolean; reason?: string }`
  - `function journeySteps(s: JourneyState): StepStatus[]`
  - `function initialStep(s: JourneyState): Step`
  - `function canVerify(s: JourneyState): { allowed: boolean; reason?: string }`
  Consumed by Task 4 (App).

- [ ] **Step 1: Write the failing tests** in `journey.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { journeySteps, initialStep, canVerify, type JourneyState } from './journey';

const base: JourneyState = {
  role: 'owner', planSaved: false, caseId: '', phase: undefined,
  factsExtracted: false, paymentExists: false, hasVerification: false,
  recoveryEntered: false, hasConfirmedFacts: false,
};
const avail = (steps = journeySteps(base)) => steps.filter((s) => s.available).map((s) => s.step);

describe('canVerify', () => {
  it('blocks verify from Observe with guidance and no allowance', () => {
    const r = canVerify({ ...base, phase: 'Observe' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/submit the simulated transfer/i);
  });
  it('allows verify from Check and Pause', () => {
    expect(canVerify({ ...base, phase: 'Check' }).allowed).toBe(true);
    expect(canVerify({ ...base, phase: 'Pause' }).allowed).toBe(true);
  });
  it('allows verify once a verification already exists, regardless of phase', () => {
    expect(canVerify({ ...base, phase: 'Observe', hasVerification: true }).allowed).toBe(true);
  });
});

describe('journeySteps (owner)', () => {
  it('fresh owner: only Plan available', () => {
    expect(avail()).toEqual(['Plan']);
  });
  it('plan saved: Session unlocks', () => {
    expect(avail(journeySteps({ ...base, planSaved: true }))).toEqual(['Plan', 'Session']);
  });
  it('case + extracted facts: Decision, Verify, Ally unlock; Evidence needs confirmed facts', () => {
    const steps = journeySteps({ ...base, planSaved: true, caseId: 'c1', factsExtracted: true });
    expect(avail(steps)).toEqual(expect.arrayContaining(['Plan', 'Session', 'Decision', 'Verify', 'Ally']));
    expect(avail(steps)).not.toContain('Evidence');
  });
  it('locked steps carry a reason', () => {
    const session = journeySteps(base).find((s) => s.step === 'Session')!;
    expect(session.available).toBe(false);
    expect(session.reason).toBeTruthy();
  });
});

describe('journeySteps (ally)', () => {
  it('ally sees only the Ally step available', () => {
    expect(avail(journeySteps({ ...base, role: 'ally' }))).toEqual(['Ally']);
  });
});

describe('initialStep', () => {
  it('ally → Ally', () => expect(initialStep({ ...base, role: 'ally' })).toBe('Ally'));
  it('no plan → Plan', () => expect(initialStep(base)).toBe('Plan'));
  it('plan but no case → Session', () => expect(initialStep({ ...base, planSaved: true })).toBe('Session'));
  it('loaded case → Decision', () => expect(initialStep({ ...base, planSaved: true, caseId: 'c1' })).toBe('Decision'));
  it('recovery entered → Recovery', () => expect(initialStep({ ...base, planSaved: true, caseId: 'c1', recoveryEntered: true })).toBe('Recovery'));
});
```

- [ ] **Step 2: Run, verify fail.** `npm --workspace apps/web run test -- journey` → FAIL (module not found).
- [ ] **Step 3: Implement `journey.ts`:**

```ts
import type { Phase } from '../../../packages/contracts/src/case';

export const STEPS = ['Plan', 'Session', 'Decision', 'Verify', 'Ally', 'Recovery', 'Evidence'] as const;
export type Step = (typeof STEPS)[number];

export interface JourneyState {
  role: 'owner' | 'ally' | null;
  planSaved: boolean;
  caseId: string;
  phase?: Phase;
  factsExtracted: boolean;
  paymentExists: boolean;
  hasVerification: boolean;
  recoveryEntered: boolean;
  hasConfirmedFacts: boolean;
}

export interface StepStatus { step: Step; available: boolean; reason?: string }

const VERIFY_GUIDANCE = 'Submit the simulated transfer to enable official verification.';

export function canVerify(s: JourneyState): { allowed: boolean; reason?: string } {
  if (s.hasVerification || s.phase === 'Check' || s.phase === 'Pause') return { allowed: true };
  return { allowed: false, reason: VERIFY_GUIDANCE };
}

function ownerStep(step: Step, s: JourneyState): StepStatus {
  switch (step) {
    case 'Plan': return { step, available: true };
    case 'Session': return s.planSaved ? { step, available: true } : { step, available: false, reason: 'Save your Safety Plan first.' };
    case 'Decision': return s.caseId ? { step, available: true } : { step, available: false, reason: 'Start a controlled session first.' };
    case 'Verify':
    case 'Ally': return s.factsExtracted ? { step, available: true } : { step, available: false, reason: 'Facts must be extracted first.' };
    case 'Recovery': return s.paymentExists || s.recoveryEntered ? { step, available: true } : { step, available: false, reason: 'Available once a transfer is drafted.' };
    case 'Evidence': return s.hasConfirmedFacts ? { step, available: true } : { step, available: false, reason: 'Confirm at least one fact first.' };
  }
}

export function journeySteps(s: JourneyState): StepStatus[] {
  if (s.role === 'ally') {
    return STEPS.map((step) => step === 'Ally' ? { step, available: true } : { step, available: false, reason: 'Available to the case owner.' });
  }
  return STEPS.map((step) => ownerStep(step, s));
}

export function initialStep(s: JourneyState): Step {
  if (s.role === 'ally') return 'Ally';
  if (s.recoveryEntered) return 'Recovery';
  if (!s.planSaved) return 'Plan';
  if (!s.caseId) return 'Session';
  return 'Decision';
}
```

- [ ] **Step 4: Run, verify pass.** `npm --workspace apps/web run test -- journey` → PASS. `npm --workspace apps/web run typecheck` → clean.
- [ ] **Step 5: Commit.** `git add apps/web/src/journey.ts apps/web/src/journey.test.ts && git commit -m "DSN-018: add pure journey gating + phase-based canVerify (TDD)"`

---

### Task 3: Shared UI primitives — `apps/web/src/ui/`

**Files:**
- Create: `apps/web/src/ui/Button.tsx`, `Card.tsx`, `Field.tsx`, `Badge.tsx`, `Callout.tsx`, `StepRail.tsx`, `ActionBar.tsx`, `Dialog.tsx`, `Disclosure.tsx`, `index.ts` (re-exports)
- Test: `apps/web/src/ui/ui.test.tsx`

**Interfaces:**
- Consumes: `StepStatus`, `Step` from `../journey`; `@radix-ui/react-dialog`, `@radix-ui/react-collapsible`.
- Produces (minimal, explicit props):
  - `Button({ variant?: 'primary'|'secondary'|'pause'|'cancel'|'ghost'; size?: 'sm'|'md'; disabled?; type?; onClick?; children })`
  - `Card({ title?; footer?; children })`
  - `Field({ label; hint?; error?; htmlFor?; children })`
  - `Badge({ tone?: 'simulated'|'info'|'neutral'; children })`
  - `Callout({ kind?: 'info'|'caution'|'error'; role?; children })`
  - `StepRail({ steps: StepStatus[]; current: Step; onSelect: (s: Step) => void })` — renders a `<nav aria-label="Journey">`/`<ol>`; locked steps are `disabled` with the reason as `title`/visible hint; current has `aria-current="step"`.
  - `ActionBar({ children })` — flex container ordering primary→secondary.
  - `Dialog({ open; onOpenChange; title; children })` — Radix wrapper; injects a visually-hidden `Dialog.Title` from `title`; renders Overlay + Content.
  - `Disclosure({ summary; children })` — Radix Collapsible wrapper.

- [ ] **Step 1: Write failing smoke tests** `ui.test.tsx` (behavioral, not markup-exact):

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Badge, Callout, StepRail } from './index';

describe('Button', () => {
  it('renders label and fires onClick; disabled blocks it', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
    rerender(<Button onClick={onClick} disabled>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('Badge', () => {
  it('renders Simulated text', () => {
    render(<Badge tone="simulated">Simulated</Badge>);
    expect(screen.getByText('Simulated')).toBeInTheDocument();
  });
});

describe('Callout', () => {
  it('renders error text with alert role', () => {
    render(<Callout kind="error" role="alert">Request failed</Callout>);
    expect(screen.getByRole('alert')).toHaveTextContent('Request failed');
  });
});

describe('StepRail', () => {
  it('disables a locked step and selects an available one', async () => {
    const onSelect = vi.fn();
    render(<StepRail current="Plan" onSelect={onSelect}
      steps={[{ step: 'Plan', available: true }, { step: 'Session', available: false, reason: 'Save plan first.' }]} />);
    expect(screen.getByRole('button', { name: /Session/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Plan/ }));
    expect(onSelect).toHaveBeenCalledWith('Plan');
  });
});
```

- [ ] **Step 2: Run, verify fail.** `npm --workspace apps/web run test -- ui.test` → FAIL.
- [ ] **Step 3: Implement** each primitive as a focused component using Tailwind classes bound to the tokens. `Button` maps `variant` to token-based classes and forwards `disabled`/`onClick`/`type`. `StepRail` renders an `<ol>` of `<Button variant="ghost">` with `disabled={!available}`, `aria-current` on `current`, and the `reason` shown as a small hint. `Dialog` composes `@radix-ui/react-dialog` with `VisuallyHidden`-wrapped `Dialog.Title`. `Disclosure` composes `@radix-ui/react-collapsible`. `index.ts` re-exports all.
- [ ] **Step 4: Run, verify pass + typecheck.** `npm --workspace apps/web run test -- ui.test` → PASS; `npm --workspace apps/web run typecheck` → clean.
- [ ] **Step 5: Commit.** `git add apps/web/src/ui && git commit -m "DSN-018: add shared UI primitive layer (Button/Card/Field/Badge/Callout/StepRail/ActionBar/Dialog/Disclosure)"`

---

### Task 4: App shell integration — mount fetch, StepRail, phase-gated Verify, Dialog, Callout

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx` (new)

**Interfaces:**
- Consumes: `journeySteps`, `initialStep`, `canVerify`, `JourneyState` from `./journey`; `StepRail`, `Callout`, `Dialog`, shell primitives from `./ui`.
- Produces: no new exports; `App` behavior changes only (mount fetch + gating + styled shell).

- [ ] **Step 1: Write failing tests** `App.test.tsx`. Mock `./api-client` so no network is needed:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const command = vi.fn();
const get = vi.fn();
vi.mock('./api-client', async (orig) => ({
  ...(await orig<typeof import('./api-client')>()),
  createApiClient: () => ({ command, get, download: vi.fn() }),
}));
import { App, type AuthProvider } from './App';

const auth: AuthProvider = { signInSynthetic: vi.fn().mockResolvedValue(undefined), getIdToken: vi.fn().mockResolvedValue('t') };

beforeEach(() => { command.mockReset(); get.mockReset(); window.history.pushState({}, '', '/'); });

describe('App', () => {
  it('fetches the case on mount when the URL carries a caseId', async () => {
    window.history.pushState({}, '', '/cases/c1');
    get.mockResolvedValue({ id: 'c1', version: 2, phase: 'Observe', facts: {}, confirmed: {} });
    render(<App auth={auth} />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('cases/c1'));
  });

  it('blocks Verify from an Observe-phase case: shows guidance and fires no verify call', async () => {
    window.history.pushState({}, '', '/cases/c1');
    get.mockResolvedValue({ id: 'c1', version: 2, phase: 'Observe', facts: { payee: {} }, confirmed: {} });
    render(<App auth={auth} />);
    await userEvent.click(screen.getByRole('button', { name: /synthetic user/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^Verify/ })); // step nav (no API call)
    expect(await screen.findByText(/submit the simulated transfer/i)).toBeInTheDocument();
    expect(command).not.toHaveBeenCalledWith('POST', 'cases/c1/verify', expect.anything());
  });
});
```

- [ ] **Step 2: Run, verify fail.** `npm --workspace apps/web run test -- App.test` → FAIL.
- [ ] **Step 3: Implement.** In `App.tsx`:
  - Add `useEffect(() => { if (caseId) run(() => refreshCase(caseId)); }, [caseId])` so a deep-link/reload loads the case before gating.
  - Build `JourneyState` from current state: `planSaved = planSavedFlag || !!caseView`; `phase = caseView?.phase`; `factsExtracted = facts.length > 0`; `paymentExists = !!caseView?.paymentDraft`; `hasVerification = !!verifyResult`; `recoveryEntered = !!recovery || caseView?.phase === 'Recover'`; `hasConfirmedFacts = facts.some((f) => caseView?.confirmed?.[f.field])`. Track a `planSavedFlag` state set `true` after a successful `PUT plan`.
  - Replace the raw `<nav><ol>` with `<StepRail steps={journeySteps(state)} current={step} onSelect={setStep} />`; set the initial `step` from `initialStep(state)` once the case loads.
  - In the Verify step: compute `const verify = canVerify(state)`; render `<Callout kind="info">{verify.reason}</Callout>` when `!verify.allowed`; make the verify handler guard: `if (!verify.allowed) { setError(verify.reason!); return; }` before the `POST verify` (prevents the API call → no `ILLEGAL_TRANSITION`).
  - Wrap `AllySharePreview` in `<Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)} title="What your ally would see">…</Dialog>`.
  - Replace the raw error `<p role="alert">` with `<Callout kind="error" role="alert">`. Apply the styled shell (header banner, main card) using the UI layer. Keep every existing handler, API call, role branch, and safety string.
- [ ] **Step 4: Run, verify pass.** `npm --workspace apps/web run test -- App.test` → PASS; `npm --workspace apps/web run typecheck` → clean.
- [ ] **Step 5: Commit.** `git add apps/web/src/App.tsx apps/web/src/App.test.tsx && git commit -m "DSN-018: wire styled shell, mount fetch, StepRail, phase-gated Verify, Dialog, Callout"`

---

### Task 5: Restyle Plan step — `PlanScreen.tsx`

**Files:**
- Modify: `apps/web/src/PlanScreen.tsx`
- Test: `apps/web/src/PlanScreen.test.tsx` (keep green; update only markup-coupled assertions)

**Interfaces:** Preserve `PlanScreenProps`, `PlanFormValues`, `AllyStatus` **exactly** (see spec; props: `role`, `plan?`, `allyStatus?`, `allyName?`, `onSavePlan?`, `pairingCode?`, `onRequestPairingCode?`, `onAcceptInvitation?`).

- [ ] **Step 1:** Read `PlanScreen.tsx` and `PlanScreen.test.tsx`; list the safety/semantic strings the test asserts and any mandated copy present (`Simulated`, consent/retention labels).
- [ ] **Step 2:** Replace structural markup with `Card`/`Field`/`Button`/`Badge` from `./ui`. Keep every label text, the four independent consent choices, the honest retention default, and all `onSavePlan`/pairing handlers and prop names unchanged.
- [ ] **Step 3:** Run `npm --workspace apps/web run test -- PlanScreen` → PASS (update only assertions that pinned old DOM structure, never a safety-copy assertion). `npm --workspace apps/web run typecheck` → clean.
- [ ] **Step 4: Commit.** `git add apps/web/src/PlanScreen.tsx apps/web/src/PlanScreen.test.tsx && git commit -m "DSN-018: restyle PlanScreen with the shared UI layer"`

---

### Task 6: Restyle Session + Decision cluster

**Files:**
- Modify: `apps/web/src/SessionScreen.tsx`, `DecisionMap.tsx`, `PaymentPanel.tsx`, `ActionConsole.tsx`
- Test: the matching `*.test.tsx` (keep green)

**Interfaces:** Preserve `SessionScreenProps`/`SessionStatus`/`SessionSegmentView`; `DecisionMapProps`/`DecisionMapStatus`; `PaymentPanelProps`/`PaymentPanelDraft`; `ActionConsoleProps`/`ActionConsoleCaseState` **exactly**.

- [ ] **Step 1:** Read the four components + tests; inventory mandated copy: `Controlled transcript` (SessionScreen), provenance labels `Caller claimed`/`User confirmed`/`User corrected`/`Unknown`/`Source not retained` (DecisionMap), `Simulated` (PaymentPanel/ActionConsole), `before you enter an OTP`, ≤3 cited reasons, and the continue acknowledgment-checkbox gate (ActionConsole).
- [ ] **Step 2:** Restyle with `Card`/`Field`/`Button`/`Badge`/`ActionBar`/`Disclosure` (source detail → `Disclosure`). **Do not** add a confirm dialog to Cancel; keep `onCancel` one-tap and the continue ack-checkbox gate intact. Preserve all prop names, provenance labels, the pause copy, and the "no enhanced Pause from words alone" behavior.
- [ ] **Step 3:** Run `npm --workspace apps/web run test -- SessionScreen DecisionMap PaymentPanel ActionConsole` → PASS (markup-only assertion updates; keep all behavioral + safety-copy assertions, including the immediate-`onCancel` and continue-gate tests). Typecheck clean.
- [ ] **Step 4: Commit.** `git add apps/web/src/SessionScreen.tsx apps/web/src/DecisionMap.tsx apps/web/src/PaymentPanel.tsx apps/web/src/ActionConsole.tsx apps/web/src/*.test.tsx && git commit -m "DSN-018: restyle Session + Decision cluster (transcript, facts, payment, actions)"`

---

### Task 7: Restyle Verify + Ally

**Files:**
- Modify: `apps/web/src/VerifyPanel.tsx`, `AllySharePreview.tsx`, `AllyScreen.tsx`
- Test: matching `*.test.tsx` (keep green; these render components **bare**, not inside the App Dialog)

**Interfaces:** Preserve `VerifyPanelProps`/`VerifyPanelRegistry`/`VerifyPanelResult`; `AllySharePreviewProps`; `AllyScreenProps` **exactly**. `AllySharePreview` stays bare (the Radix `Dialog` wrap lives in `App.tsx`, Task 4) so its isolation test keeps its structure.

- [ ] **Step 1:** Read the three components + tests; inventory mandated copy: registry `fictional`/`simulated: true` labelling, `Caller claimed` excerpt framing, the minimum-packet fields only (claim, proposed action, amount, verification gap, selected evidence), and that the ally view cannot approve a transfer or certify the caller.
- [ ] **Step 2:** Restyle with the UI layer. Keep the Demo Bank registry result's persistent simulation status, the minimal ally packet, and all prop names/handlers. Do not expose any fund-control or caller-certification control.
- [ ] **Step 3:** Run `npm --workspace apps/web run test -- VerifyPanel AllySharePreview AllyScreen` → PASS. Typecheck clean.
- [ ] **Step 4: Commit.** `git add apps/web/src/VerifyPanel.tsx apps/web/src/AllySharePreview.tsx apps/web/src/AllyScreen.tsx apps/web/src/*.test.tsx && git commit -m "DSN-018: restyle Verify panel and ally preview/screen"`

---

### Task 8: Restyle Recovery + Evidence (preserve route heading parity)

**Files:**
- Modify: `apps/web/src/RecoveryScreen.tsx`, `EvidenceScreen.tsx`
- Test: matching `*.test.tsx` (keep green)

**Interfaces:** Preserve `RecoveryScreenProps`/`EditedPaidDetails`; `EvidenceScreenProps`/`EvidenceTimelineEntry`/`EvidenceRetentionMode` **exactly**.

- [ ] **Step 1:** Read both components + tests. Note `RecoveryScreen.test.tsx:33` asserts the Demo Bank and `1930` headings share the same `tagName` (equal-weight real-vs-simulated routes) — this must survive. Inventory copy: `1930`, `cybercrime.gov.in`, `Unknown` (blank unknown fields), recovery-scam warning, and the export label `field-aligned preview—not submitted or accepted`; proposed vs actually-paid distinction.
- [ ] **Step 2:** Restyle with `Card`/`Button`/`Badge`/`ActionBar`. Render the simulated Demo Bank route and the real 1930 route as **equal-size stacked cards at the same heading level**. Keep unknown transaction fields blank, the proposed-vs-paid distinction, the recovery-scam warning, and the export-preview labelling. Preserve all prop names.
- [ ] **Step 3:** Run `npm --workspace apps/web run test -- RecoveryScreen EvidenceScreen` → PASS, **including the heading-parity assertion** (update it only if the restyle keeps parity at a different but still-equal tag; never drop the parity check). Typecheck clean.
- [ ] **Step 4: Commit.** `git add apps/web/src/RecoveryScreen.tsx apps/web/src/EvidenceScreen.tsx apps/web/src/*.test.tsx && git commit -m "DSN-018: restyle Recovery (equal-weight routes) and Evidence screens"`

---

### Task 9: Full verification + finalize records

**Files:**
- Modify: `project/tasks/in-progress/DSN-018-frontend-styled-journey.md` → move to `project/tasks/done/` (integrator at merge)
- Modify: `docs/demo-runbook.md` (note the styled journey if any run step changed)

- [ ] **Step 1: Full suite.** `npm run typecheck` (3 workspaces) → clean. `npm --workspace apps/web run test` → all green (109 existing + `journey`/`ui`/`App` additions; e2e still excluded). `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test'` → 355/355 unchanged (no API change). *(JAVA_HOME must point at a JDK 21+ in the shell — never commit the path.)*
- [ ] **Step 2: Hygiene.** `git diff --check` → clean. `git grep -nE "sfdc|salesforce|chander|/Users/|repo.local|bazel_jdk|apikey|password|secret" -- apps/web project/decisions/0008-frontend-styling-stack.md` → no hits. Confirm commit author/committer = personal no-reply identity.
- [ ] **Step 3: Manual walkthrough.** `npm run dev:api` + `npm run dev:web`; sign in as owner; walk Plan → Session → Decision → (draft+submit simulated transfer) → Verify → Ally → cancel → Recovery → Evidence; confirm styled, responsive (resize to ~440px), the persistent Simulated + pre-OTP banner, and **no `ILLEGAL_TRANSITION` from any interaction**, including attempting Verify from a quiet case (expect the guidance Callout). Record the result in the task.
- [ ] **Step 4: Finalize the task record** with commands/results/changed paths/commit IDs/limitations (a11y deferred to DSN-019; production CSS build still in the blocked deploy path). Leave the `done` move to the integrator merge step per `project/WORKFLOW.md`.
- [ ] **Step 5: Commit** any runbook/record edits. `git commit -m "DSN-018: record full-suite verification and manual walkthrough"`

---

## Notes for the integrator (post-implementation)

- This branch is `task/DSN-018-frontend-styled-journey` off `main`. Review the whole branch, run the post-integration gate (typecheck, web suite, API emulator suite, `git diff --check`, hygiene grep), then `--no-ff` merge to local main and move the task record to `done`. Pushing to origin is authorized; deploy/cloud is not.
- If a restyle forces a genuine prop-interface change (should not happen — all props are injected callbacks/data), stop and coordinate rather than breaking a consumer.
