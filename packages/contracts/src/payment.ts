// Payment simulator contract (plan Task 6 / DSN-008). Mirrors case.ts and
// facts.ts's split: this file holds only types; Firestore-touching draft
// save/submit/recheck logic lives in apps/api/src/{payment,payment-routes}.ts
// and must not be duplicated here.
//
// Decision 0001: this prototype never settles a transfer. `PaymentState`
// has no "completed"/"held"/"reversed" value and never will within this
// task's scope - every submitted draft lands `pending`; only an explicit
// human action (DSN-009) can ever move it to `paused`/`cancelled`/
// `continued`. The UI must persistently label this surface **Simulated**
// (wireframes 02/03).

import type { CaseEnvelope } from './case.js';

/**
 * A proposed transfer. `beneficiaryId`/`amountMinor` are the only fields the
 * browser ever sends (PRD C4; decision 0001) - `newPayee` is always
 * server-derived from the owner's own payee history, never client-supplied,
 * and `version` is a draft-local counter: every edit (including an edit made
 * after submission) creates a new immutable `id` and increments `version`,
 * which invalidates any previously validated `CandidateRelation` outright -
 * see `PaymentProjection`'s doc comment.
 */
export interface PaymentDraft {
  id: string;
  beneficiaryId: string;
  amountMinor: number;
  newPayee: boolean;
  version: number;
}

/**
 * Lifecycle of one case's open payment draft. There is deliberately no
 * "settled"/"held"/"reversed" value - `submitIntent` only ever produces
 * `pending`, and nothing in this module's scope can ever change that; moving
 * to `paused`/`cancelled`/`continued` is an explicit human decision recorded
 * by DSN-009's `act()`, never a side effect of a draft edit, a model result,
 * or a race.
 */
export type PaymentState = 'draft' | 'pending' | 'paused' | 'cancelled' | 'continued';

/**
 * One fixed, source-grounded reason surfaced alongside a policy-driven
 * `phase` change. Structurally mirrors `apps/api/src/policy.ts`'s
 * `GroundedReason` (this file must not import from `apps/api`, so the shape
 * is duplicated rather than referenced) - `code`/`text` are always one of
 * policy.ts's fixed, documented reason codes and their fixed text, never
 * model-authored (PRD 7.3/8.2).
 */
export interface PaymentReason {
  code: string;
  text: string;
  sourceSegmentIds: string[];
  paymentEventId?: string;
  correctionEventId?: string;
}

/**
 * The case projection fields this feature adds on top of the foundation
 * `CaseEnvelope`. `segmentIds` is this module's own snapshot of the case's
 * ordered transcript segment ids at the time of the last draft save or
 * relation recheck - used to confirm a `CandidateRelation` only ever cites
 * segments that actually exist on the current case (defense in depth
 * alongside the `inputCaseVersion` check). `reasons` is the fixed,
 * source-grounded reason list from the most recent policy-driven `phase`
 * change (see `apps/api/src/policy.ts`'s `assessCase`) - never free text,
 * never a scam-probability score or mental-state label (PRD 7.3/C12).
 */
export interface PaymentProjection extends CaseEnvelope {
  paymentDraft?: PaymentDraft;
  paymentState: PaymentState;
  segmentIds: string[];
  reasons: PaymentReason[];
}
