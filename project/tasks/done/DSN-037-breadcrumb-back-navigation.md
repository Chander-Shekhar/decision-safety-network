# DSN-037: Breadcrumb back-navigation in the app shell

- **Scope:** enhancement (navigation affordance)
- **Priority:** P2
- **Owner:** Orchestrator (solo owner — claim + implement + integrate per WORKFLOW "Solo owner")
- **Branch/worktree:** `task/DSN-037-breadcrumb-nav`
- **Owned paths:** `apps/web/src/AppShell.tsx`, `apps/web/src/AppShell.test.tsx`, this task record.
- **Dependencies:** DSN-034 (mobile shell + burger-menu nav).
- **PRD references:** Core MVP app shell / navigation.
- **Decision references:** None — the nav pattern was chosen directly by the founder (authority order #1); no new architecture/interface contract beyond the existing shell.
- **Started:** 2026-10-15
- **Last updated:** 2026-10-15

## Outcome

The sticky top bar now shows a breadcrumb trail (`Home › <screen>`) on secondary views (Settings, Cases, About), with `Home` clickable to go back up. Previously the burger menu was the only way back out of those screens. The burger is retained for jumping anywhere.

Founder choices (recorded at request time): breadcrumb trail **plus** burger (not a back-arrow); small font, single line, must not overlap the burger; **inside an open case the StepRail keeps owning step navigation**, so the breadcrumb stays at the Home root there (no `Home › Case › Step` trail).

## Boundaries

- Included: breadcrumb trail in `AppShell` for owner secondary views; `Home` crumb navigates to the home view (reusing the existing `onNavigate` + menu-close path); short crumb labels; truncation so it never overlaps the burger; Home root keeps the wordmark; ally mode unchanged (keeps "← My view", no breadcrumb/burger).
- Excluded: in-case step breadcrumbs (left to the StepRail by decision); any change to the burger menu contents or to view/step state in `App.tsx`; URL/history-based routing.

## Design notes

- Two nav axes already existed: top-level **views** (burger) and journey **steps** (StepRail, inside Home). The gap was leaving a secondary view, where only the burger worked. The breadcrumb targets exactly that gap and deliberately does not duplicate the StepRail.
- The trail is a real `<nav aria-label="Breadcrumb">` with an ordered list; the current crumb carries `aria-current="page"`; `Home` is a button. `min-w-0` + `truncate` keep it on one line within the 480px bar.

## Acceptance checks

- [x] A secondary view shows a `Breadcrumb` nav with a working `Home` button and the current screen marked `aria-current="page"`. — `apps/web/src/AppShell.test.tsx`
- [x] Each secondary view maps to its short crumb label (Cases / Settings / About). — `AppShell.test.tsx`
- [x] The Home root shows the wordmark and no breadcrumb. — `AppShell.test.tsx`
- [x] Ally mode is unchanged: return path present, no breadcrumb or burger. — `AppShell.test.tsx`
- [x] typecheck clean; full web unit suite green.

## Verification evidence

- **Commits:** d93547d (implementation + tests).
- **Integration commit:** recorded post-merge below.
- **Commands and results:**
  - `apps/web`: `tsc --noEmit` clean; `vitest run` 25 files / 225 tests pass (was 24 / 221; +1 file, +4 AppShell tests).
- **Changed paths:** `apps/web/src/AppShell.tsx`, `apps/web/src/AppShell.test.tsx`.
- **Limitations or skipped checks:** API suite not relevant (web-only). Playwright e2e not re-run — the change is presentational and keeps the burger ("Open menu") and the Home wordmark the journey e2e relies on; no existing selector changes.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Integrate to `main`; record integration commit + post-integration verification.
- **Unresolved issues:** None recorded.
