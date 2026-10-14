# Design: Mobile app shell, navigation, and consolidated Settings (DSN-034)

**Status:** Founder-approved direction (2026-10-14/15). Implementation guide for DSN-034.
Authority: direct founder instruction > locked PRD > decision 0010 (disclosure) > this spec > code.
Governed by `docs/founder-demo-vision.md` and the wireframe README intent (focused case flow).

## Goal

Make the web app read as a polished, mobile-friendly app, remove demo-ish caveat clutter,
and tighten the first-run → setup → session path. No backend or contract change.

## Decisions carried from brainstorming

1. **Web layout:** mobile-first single column, `max-w-[480px]`, centered, full height. No hard device bezel.
2. **Settings trim:** essentials visible (call listening, Safety Ally, protected accounts, allow-processing);
   retention mode, ally share-field picker, evidence export, and large-payee threshold move into a closed
   **Advanced** disclosure. Nothing is deleted — defaults preserve current `PUT plan` behavior.
3. **Disclosure:** one consolidated **About this demo** entry; remove scattered "synthetic / prototype /
   simulated" copy; keep a light point-of-use `illustrative` tag only on bank/authority/payment actions
   (decision 0010). No `AGENTS.md` change needed — the relaxed contract already permits this.
4. **Sidebar:** Home · Cases · Settings · About this demo.
5. **Call input:** a 3-mode switcher — **Live call** · **Paste transcript** · **Upload recording** — that
   preserves the real DSN-025 capture path; the "incoming call" screening remains the Live-call entry.

## Architecture

### Shell & navigation
- New `AppShell` wraps every screen: centered `max-w-[480px]` column, sticky top bar with a **burger**
  button + wordmark, and a left slide-in **Drawer** (`ui/Drawer`, Radix Dialog-based, focus-trapped).
- `App` holds a top-level `view: 'home' | 'cases' | 'settings' | 'about'`. The in-case flow (Session…Evidence)
  renders when a case is active / the user starts a session; a compact in-case step indicator replaces the
  always-visible `StepRail` as app chrome (StepRail is reused inside the case flow only).
- **Auth:** auto sign-in as owner on mount (owner is the demo persona). The drawer footer offers a plain
  **"Open ally view"** toggle (calls `signInSynthetic('ally')`). No "synthetic" wording surfaces.

### Screens
- `HomeScreen` gains a **first-run** variant (`firstRun` + `onOpenSettings`): a warm "first time here" card,
  one line on what DSN does, a primary **Set up protection** → Settings, and a quiet About link. Configured
  Home keeps the "You're protected" summary + **Start a protected session**.
- `SettingsScreen` (new) merges first-run Setup + Safety Plan essentials with an Advanced disclosure. Emits a
  single `onSave(SetupValues + plan fields)` the App maps onto `PUT plan`. Shows a **sample ally** as ready;
  real pairing-code entry still available.
- `AboutScreen` (new): the single consolidated honesty disclosure (which integrations are illustrative, that
  data is sample data, that nothing contacts a real bank/authority).
- `CasesScreen` (new): list of handled cases; empty-state acceptable for now (establishes IA; the vision's
  "persistent record"). May surface the current open case as a shortcut.
- `SessionInput` (new): segmented control hosting Live call (screening + capture-status note; a browser note
  that live capture runs in the mobile app), Paste transcript, Upload recording. Paste/Upload reuse the
  existing `submitPastedTranscript` / `submitAudioRecording` pipeline.

### Copy pass (apps/web only)
- Remove the header disclaimer and the sign-in buttons from `App`.
- Replace scattered "Simulated/Prototype" badges/labels with a muted point-of-use `illustrative` tag on:
  payment cancel/continue (`ActionConsole`), bank verification (`VerifyPanel`), guided freeze/recovery
  (`RecoveryScreen`), the 1930/NCRP draft (`EvidenceScreen`), caller-ID screening (`ScreeningScreen`).
- Reword `TranscriptEntry` and `SessionScreen` capture copy to be capability-forward while staying honest
  about audio handling/consent (the capture honesty is a privacy fact, not a demo caveat).
- `index.html` title → "Decision Safety Network".
- Keep the fictional **Demo Bank** name (About explains it is illustrative); a full rename is a flagged
  follow-up because it touches API display strings + the deterministic Playwright journey.

## Data flow & error handling
- No new API calls or contracts. Plan load/first-run detection unchanged (`plan.setupCompletedAt`; 404 = fresh).
- Settings save = existing `PUT plan` (+ optional `POST ally-invitations` when a pairing code is entered).
- Drawer/role-switch is pure client state. All existing run()/ApiError handling preserved.

## Accessibility
- Drawer: Radix Dialog (focus trap, Esc, labelled). Burger button has an accessible name and `aria-expanded`.
- All nav items are real buttons with visible focus; no color-only state; large touch targets (mobile).
- Preserve existing `aria-label` region names where tests depend on them, except where the redesign
  intentionally renames a region (tests updated in lockstep).

## Testing
- Vitest: new tests for shell/drawer nav, first-run Home, Settings (essentials + Advanced + save), and the
  SessionInput switcher. Update `App.test` for auto sign-in, the removed header disclosure, and new nav.
- Preserve DSN-025 bridge tests (update only the capture-label text assertion).
- Playwright `journey.spec`: update `createConfiguredOwner` to go through Settings and the session switcher;
  run against the local emulator stack, or document the skip if the stack can't boot in this environment.
- Gates: `typecheck` clean, vitest green, e2e run-or-documented.

## Out of scope
- `apps/api`, `packages/contracts`, `apps/android`; Demo Bank rename; new product capabilities; dashboard.
