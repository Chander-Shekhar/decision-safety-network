// Deterministic legal phase transitions (plan Task 5 / DSN-007). Pure: no
// Firestore, no network, no @google/genai. This is the *only* legal path
// between Safety Case phases - no route and no model output may advance
// `phase` by any other means (PRD Part I "Canonical Cup state transitions").

import type { Phase } from '@dsn/contracts';

/**
 * The canonical Cup state-transition table, taken verbatim from the locked
 * PRD. Plan Task 5's executable table matches this exactly - no PRD-vs-plan
 * reconciliation was needed for DSN-007.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<Phase, readonly Phase[]>> = {
  Observe: ['Check', 'Recover', 'Resolve'],
  Check: ['Observe', 'Pause', 'Verify', 'Recover', 'Resolve'],
  Pause: ['Check', 'Verify', 'Recover', 'Resolve'],
  Verify: ['Pause', 'Recover', 'Resolve'],
  Recover: ['Resolve'],
  Resolve: ['Recover'],
};

/**
 * Advances `from` to `to` if, and only if, that pair appears in
 * `ALLOWED_TRANSITIONS`; otherwise throws `ILLEGAL_TRANSITION`.
 *
 * `cause` is opaque, free-form audit metadata for the caller's own event
 * record (e.g. DSN-009's `CaseEvent.kind`/`refs`) - it is never inspected by
 * this function and can never unlock a pair the table forbids. A `cause` of
 * `'model'`, `'model-timeout'`, or `'user-override'` is exactly as
 * constrained as any other: generative output can describe *why* a
 * transition was requested, but never *whether* it is legal.
 */
export function transition(from: Phase, to: Phase, cause: string): Phase {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error('ILLEGAL_TRANSITION');
  }
  return to;
}
