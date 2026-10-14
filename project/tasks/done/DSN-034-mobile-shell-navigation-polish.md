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

- Included: app shell + drawer nav; top-level view routing (home/cases/settings/about) alongside the in-case flow; first-run Home; consolidated Settings merging first-run Setup + Safety Plan essentials, with Advanced holding retention/share-fields/export/threshold; sample ally display; three-mode session input switcher; copy pass removing scattered demo caveats in favor of one About disclosure + point-of-use `illustrative` indicators; auto sign-in (owner by default; the ally opens their own window/device at `?role=ally`, matching the documented two-context emulator-auth model).
- Excluded: any `apps/api`/`packages/contracts` change; renaming the fictional "Demo Bank" institution; real cross-device ally pairing changes (sample ally is a ready-looking presence; real pairing path remains); new product capabilities beyond the approved vision.

### Decisions taken autonomously (for morning review)

1. **In-app "Open ally view" switch dropped in favor of `?role=ally`.** Firebase `signInAnonymously` returns the *same* persisted anon user per browser context and ignores the role argument, so an in-app owner→ally toggle would have given the ally the owner's own uid (breaking ally-share) or silently reset owner state. The documented model is one browser context per role; the ally opens their own window/device at `?role=ally`. The owner shell therefore shows no ally-switch button.
2. **"Demo Bank" fictional name retained.** Renaming would touch the API registry id (`demo-bank`), the web-verification matcher, and the deterministic Playwright journey keys — out of this task's `apps/web`-only scope. Flagged as an optional follow-up (a full institution rename task). Visible caveat words were still stripped where safe (e.g. "Load Demo Bank registry" → "Load verification registry"; "demo number" → "sample number"; title "(simulated prototype)" removed).
3. **Point-of-use "Simulated" indicators on money/authority actions kept.** Decision 0010 explicitly allows a light point-of-use indicator where an action could be mistaken for a real-world effect (payment submit, official verify, guided freeze, 1930 report, caller-ID). These carry test-locked trust-safety meaning; ripping all ~45 out overnight would regress deliberate honesty coverage. The scattered *onboarding* caveats the founder flagged (first screen, header, capture label) were removed and consolidated into the About screen. The founder's own pre-demo disclaimer covers global framing.
4. **Sample ally modeled as `allyStatus: 'ready'` + `allyIsSample` flag.** Settings labels it "(sample ally)"; entering a real pairing code clears the sample flag and moves to `invited`. No contract change.

### Adversarial code review — findings and dispositions

A read-only adversarial review of the full working tree ran before integration. It found no critical bugs and no honesty-labeling regression. Dispositions:

1. **(MEDIUM) Session step was a dead wait-screen on the web — FIXED.** `SessionInput` was only on the Decision step, so a web owner who started a session saw an empty live-transcript area with no paste/upload affordance. Added the switcher plus a "Go to the decision" button to the Session step (gated on an open case). Locked by `App.test.tsx` "gives a web owner a way to bring the call in on the Session step".
2. **(LOW/MED) `SessionInput` tab ARIA was half-implemented — FIXED.** Completed the WAI-ARIA tablist pattern: `id`/`aria-controls`, `role="tabpanel"` + `aria-labelledby`, roving `tabindex`, and arrow/Home/End traversal. Locked by `SessionInput.test.tsx` "traverses tabs with the arrow keys".
3. **(LOW) Dead `onOpenAllyView` prop + Drawer block in `AppShell` — FIXED.** Removed; the in-app ally opener is intentionally gone (decision 1 above), so the prop and its unreachable Drawer block are deleted to avoid a misleading component API.
4. **(LOW) Home showed "Ally ready" for the seeded sample — FIXED.** `HomeScreen` now renders "Ally ready (sample)" via a passed `allyIsSample`, so a viewer doesn't mistake the sample for a real paired helper. Locked by `HomeScreen.test.tsx` "marks the ready ally as a sample".
5. **(LOW) Mixed disclosure vocabulary ("Simulated" badges vs new "Illustrative" tag) — NOT CHANGED (conscious).** The money/authority surfaces (`PaymentPanel`/`VerifyPanel`/`EvidenceScreen`) are outside this task's changed set and their point-of-use "Simulated" labels carry test-locked trust-safety meaning. Decision 0010 permits them (over-disclosure is safe). Flagged as an optional later consistency pass; not touched overnight to avoid regressing deliberate honesty coverage.
6. **(INFO) `signInSynthetic(role)` ignores its arg / seeded sample ally has no real uid.** Acknowledged pre-existing two-context auth model (decision 1) and DSN-014-blocked ally-uid plumbing; not a regression from this task. No change.

## Acceptance checks

- [x] Fresh owner lands on a first-run Home that names it as a first run and links to Settings; no forced blocking wizard. — App.test.tsx "routes a fresh owner … into a first-run home"
- [x] Burger drawer navigates Home/Cases/Settings/About; focus-trapped and keyboard-operable (Radix Dialog). — App.test.tsx "exposes burger-menu navigation"; Drawer built on `@radix-ui/react-dialog`
- [x] Settings shows essentials (call listening, Safety Ally with a sample ally, protected accounts, allow-processing) and an Advanced disclosure (retention, ally share fields, export, threshold); saving persists via `PUT plan`. — SettingsScreen.test.tsx
- [x] Session input offers Live call / Paste transcript / Upload recording; paste + upload drive the existing segments→extract pipeline; the DSN-025 live capture bridge still works. — SessionInput.test.tsx + App bridge tests green
- [x] Exactly one consolidated disclosure (About this demo); onboarding "synthetic/prototype" wording removed; money/authority actions keep a light point-of-use indicator (decision 0010). — App.test.tsx chrome assertion + grep
- [x] `typecheck` clean; vitest green (215); Playwright e2e updated and run (8/8, both viewports).

## Verification evidence

- **Commits:** 8aebe3b (claim + design spec); ac33bbf (implementation + review fixes).
- **Integration commit:** 106ebd9 (`--no-ff` merge of `task/DSN-034-mobile-shell-nav` into `main`).
- **Commands and results:**
  - `npx tsc --noEmit` (apps/web) — clean.
  - `npx vitest run` (apps/web) — 24 files, 215 tests passed.
  - `npx playwright test` — 8 passed (desktop + mobile-440), local emulator + fake-Gemini stack. Run with `JAVA_HOME=/opt/homebrew/opt/openjdk@21` and `node_modules/.bin` on PATH (global `firebase`/JDK21 not on the default PATH; see Limitations).
- **Post-integration verification:** on `main` after the merge — `tsc --noEmit` clean; `vitest run` 24 files / 215 tests pass. (e2e proven on the identical pre-merge branch tree: 8/8.)
- **Changed paths:** `apps/web/src/{App,HomeScreen,SessionScreen,ScreeningScreen}.tsx`; new `apps/web/src/{AppShell,SettingsScreen,SessionInput,CasesScreen,AboutScreen}.tsx` + `ui/{Drawer,IllustrativeTag}.tsx` + `ui/index.ts`; new tests `{HomeScreen,SettingsScreen,SessionInput}.test.tsx` + updated `{App,SessionScreen}.test.tsx`; removed `{SetupScreen,TranscriptEntry}.{tsx,test.tsx}`; `apps/web/index.html` (title); `apps/web/e2e/journey.spec.ts`.
- **Limitations or skipped checks:** e2e requires JDK 21 as `JAVA_HOME` and the local `firebase-tools` on PATH (ambient `JAVA_HOME` pointed at an older JDK; global `firebase` absent). No code change needed — just the invocation env. "Demo Bank" institution name not renamed (optional follow-up, see Decisions). Point-of-use "Simulated" indicators on money/authority actions intentionally retained (decision 0010).

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Implement per the approved design/spec, run checks, self-review, integrate to `main`.
- **Unresolved issues:** None recorded.
