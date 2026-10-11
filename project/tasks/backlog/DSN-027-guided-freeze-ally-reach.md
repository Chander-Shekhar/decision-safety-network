# DSN-027: Guided account freeze + ally WhatsApp/contact-caller

- **Scope:** core
- **Priority:** P1
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** None until claimed (expected: `apps/api/src/{recovery,ally}*`, `packages/contracts/src/{recovery,ally}.ts`, `apps/web/src/{RecoveryScreen,AllyScreen,AllySharePreview}.tsx`)
- **Dependencies:** DSN-022
- **PRD references:** Part I — Decisions 17 & 20; C8 (WhatsApp + contact caller); C10 (guided freeze); non-goal (no real freeze); gates (minimum ally packet, revocation)
- **Decision references:** 0010
- **Started:** Not started
- **Last updated:** 2026-10-11

## Outcome

Recovery offers guided protection for the affected account — bank helpline number plus a prepared, case-filled "what to say" script — with no real freeze. The Safety Ally can be reached via a WhatsApp summary (deep link / share) and has an "contact the caller on the user's behalf" action, while still unable to control funds or certify the caller.

## Boundaries

- Included: guided-freeze card (affected account only, helpline + script), WhatsApp summary deep-link for the ally, ally→caller contact action, preserved minimum-packet + revocation semantics.
- Excluded: any real bank freeze/integration; ally fund control or caller certification; auto-sending without the user's action.

## Acceptance checks

- [ ] Recovery shows a guided-freeze card scoped to the affected account with a case-filled script; no real freeze is performed or implied.
- [ ] The ally can be reached via a WhatsApp summary containing only the minimum packet; the ally→caller contact action is available.
- [ ] Ally still cannot fetch the full transcript/unshared evidence or control funds/certify (direct API test); revocation removes access on the next request.
- [ ] API + web suites green; typecheck clean.

## Verification evidence

- **Commits:** None
- **Integration commit:** Not integrated
- **Commands and results:** None
- **Post-integration verification:** Not run
- **Changed paths:** None
- **Limitations or skipped checks:** None

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Prepare and claim after DSN-022.
- **Unresolved issues:** None recorded.
