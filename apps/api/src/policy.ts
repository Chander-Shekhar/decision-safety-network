// Deterministic versioned decision policy (plan Task 5 / DSN-007). Pure
// functions only: no Firestore, no network, no @google/genai. Gemini (or any
// other model) is only ever a source of validated boolean/id-shaped signals
// upstream of this module (DSN-006's facts, DSN-008's matched payment
// relation) - this is the only place those signals become a `Phase` and the
// reasons shown to the user. Recording `POLICY_VERSION` and reason codes on
// a persisted case event is the consumer's job (DSN-009), not this module's.

import type { Phase } from '@dsn/contracts';

/** Versioned policy identity. Persisted by the consumer on every policy-driven case event; bump on any predicate or reason change. */
export const POLICY_VERSION = 'cup-core-1';

/**
 * Fixed, documented reason codes - the only thing a consumer or UI may
 * branch on. `text` is assembled by this module from a fixed string per
 * code (see `buildReasons`), never supplied by a caller: PRD 7.3/8.2
 * prohibit free-form generated text that itself selects or justifies an
 * action.
 *
 * - `manipulation-cues`: an observed-tactics pressure cue is present (PRD 7.1.A).
 * - `unverified-claim`: the claimed identity/claim has not been independently verified (PRD 7.1.C).
 * - `large-new-payee`: the open payment is a new payee above the plan's threshold *and* the
 *   conversation has been validated as directing this specific payment (PRD C4). Never emitted
 *   without a validated matching relation, so a large payment is never cited as a reason unless
 *   it is actually joined to the conversation.
 * - `correction-rollback`: an owner correction was applied and the case has been re-checked
 *   (PRD causal acceptance matrix, row 4). This policy is stateless - it has no record of what,
 *   if anything, was previously joined - so this code and its fixed text only ever assert that a
 *   correction happened and the case is being re-evaluated, never that a conversation/payment join
 *   previously existed. It is only emitted when it carries a valid reference (see
 *   `AssessCaseInput.correctionEventId`); an ungrounded correction is never asserted as a reason.
 */
export type ReasonCode = 'manipulation-cues' | 'unverified-claim' | 'large-new-payee' | 'correction-rollback';

/** One reason shown to the user. Every field is a reference or a fixed label - never free text that itself picks an action. */
export interface GroundedReason {
  code: ReasonCode;
  text: string;
  sourceSegmentIds: string[];
  paymentEventId?: string;
  correctionEventId?: string;
}

/**
 * Validated signals this policy decides on. The caller (DSN-008/DSN-009) is
 * responsible for having already validated `matchingRelation` against the
 * *current* payment draft and case version (PRD C4; decision 0001) before
 * calling this function - `assessCase` never re-derives it and never treats
 * generic conversation risk or amount alone as a matching relation.
 */
export interface AssessCaseInput {
  /** A manipulation-pressure cue is present in the conversation (PRD 7.1.A). */
  cues: boolean;
  /** The claimed identity/claim is not independently verified (PRD 7.1.C). */
  unverified: boolean;
  /** The open payment draft has already been validated as the one the conversation is directing (PRD C4). */
  matchingRelation: boolean;
  /** The open payment is a new payee above the plan's threshold. */
  largeNewPayee: boolean;
  /** An owner correction was applied to this case (PRD causal matrix row 4 rollback trigger). This policy does not know, and never claims, what - if anything - was previously joined. */
  corrected?: boolean;
  /** Transcript segments backing `cues`/`unverified`/`matchingRelation`; cited verbatim onto whichever reasons need them. */
  sourceSegmentIds?: string[];
  /** The payment draft/submit event backing `largeNewPayee`; cited only onto the `large-new-payee` reason. */
  paymentEventId?: string;
  /**
   * The `fact-corrected`/`fact-confirmed` `CaseEvent` id backing `corrected` (DSN-006's
   * `correctFact`/`confirmFact`, which record `sourceSegmentIds: []` for the correction itself -
   * a correction is not transcript-sourced). Caller contract: whenever `corrected` is true, pass
   * this id so the `correction-rollback` reason has something honest to cite; cited only onto
   * that reason.
   */
  correctionEventId?: string;
}

export interface AssessCaseResult {
  phase: Phase;
  reasons: GroundedReason[];
}

const MAX_REASONS = 3;

/**
 * The joined ("enhanced") Pause predicate. Deliberately requires manipulation
 * cues *and* an unverified claim *and* a validated matching relation *and* a
 * large new payee - never generic conversation risk or amount alone - and is
 * retracted outright by a correction (PRD causal acceptance matrix rows 1-4).
 */
function isJoined(input: AssessCaseInput): boolean {
  return !input.corrected && input.cues && input.unverified && input.matchingRelation && input.largeNewPayee;
}

/** Deterministic phase selection. The four PRD causal-matrix rows are direct cases of this. */
function selectPhase(input: AssessCaseInput): Phase {
  if (isJoined(input)) {
    return 'Pause';
  }
  if (input.corrected) {
    return 'Check';
  }
  if (input.cues && input.unverified) {
    return 'Check';
  }
  return 'Observe';
}

/**
 * Builds the fixed-priority reason list, then caps it at `MAX_REASONS`.
 * Priority order: the correction that caused a rollback, then the two
 * conversation signals, then the payment signal. The cap is never actually
 * reached by more than `MAX_REASONS`: `correction-rollback` can combine with
 * at most the two conversation reasons (3 total), and `large-new-payee` can
 * only appear via `isJoined`, which requires `!corrected` and therefore
 * excludes `correction-rollback` (manipulation-cues + unverified-claim +
 * large-new-payee is also exactly 3).
 */
function buildReasons(input: AssessCaseInput): GroundedReason[] {
  const sourceSegmentIds = input.sourceSegmentIds ?? [];
  const reasons: GroundedReason[] = [];

  if (input.corrected) {
    // This policy is stateless: it has no record of what, if anything, was
    // previously joined, so the text never claims a prior join - only that a
    // correction happened and the case was re-checked. A correction itself
    // is not transcript-sourced (DSN-006's correctFact/confirmFact record
    // `sourceSegmentIds: []`), so `correctionEventId` is the honest primary
    // reference; `sourceSegmentIds` is accepted as a fallback only if the
    // caller actually supplied one (e.g. citing the original claim that was
    // corrected). With neither, there is nothing honest to cite, so the
    // reason is omitted entirely rather than asserted ungrounded - the
    // `Check` phase itself still reflects the rollback either way.
    const hasReference = Boolean(input.correctionEventId) || sourceSegmentIds.length > 0;
    if (hasReference) {
      reasons.push({
        code: 'correction-rollback',
        text: 'An owner correction was applied to this case, which has been re-checked as a result.',
        sourceSegmentIds,
        ...(input.correctionEventId ? { correctionEventId: input.correctionEventId } : {}),
      });
    }
  }
  if (input.cues && input.unverified) {
    reasons.push({
      code: 'manipulation-cues',
      text: 'A pressure tactic was observed in the conversation.',
      sourceSegmentIds,
    });
    reasons.push({
      code: 'unverified-claim',
      text: 'The claimed identity or claim has not been independently verified.',
      sourceSegmentIds,
    });
  }
  if (isJoined(input)) {
    reasons.push({
      code: 'large-new-payee',
      text: 'The open payment is a new, above-threshold transfer that the conversation is directing.',
      sourceSegmentIds,
      ...(input.paymentEventId ? { paymentEventId: input.paymentEventId } : {}),
    });
  }

  return reasons.slice(0, MAX_REASONS);
}

/**
 * Turns validated decision-context signals into a `Phase` and at most three
 * source-grounded reasons. Pure and total: never throws, never calls out,
 * and ignores any property on `input` other than the ones declared on
 * `AssessCaseInput` - there is no field through which model-authored text
 * could select a phase or an action.
 */
export function assessCase(input: AssessCaseInput): AssessCaseResult {
  return { phase: selectPhase(input), reasons: buildReasons(input) };
}
