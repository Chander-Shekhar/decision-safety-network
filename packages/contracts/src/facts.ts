// Live-facts contract (plan Task 4 / DSN-006). Mirrors case.ts and
// session.ts's split: this file holds only types; Firestore-touching
// extraction, validation, correction, and confirmation logic lives in
// apps/api/src/{gemini,fact-validator,fact-routes}.ts and must not be
// duplicated here.

import type { CaseEnvelope } from './case.js';

/** How confident the model is in one extracted value. Never a scam probability or mental-state label (PRD C3/C12). */
export type FactUncertainty = 'low' | 'medium' | 'high';

/**
 * Who last asserted a fact's current value. `model` is Gemini's own
 * extraction - never independently verified. `user-confirmed` means the
 * owner confirmed what was said or entered (not that the caller's claim is
 * genuine - see wireframes README's "Provenance is not truth" rule).
 * `user-corrected` means the owner replaced the value outright.
 */
export type FactOrigin = 'model' | 'user-confirmed' | 'user-corrected';

/**
 * The fixed set of structured fields Gemini extracts, per PRD C3: claimed
 * identity, central claim/threat, requested action, amount, payee, deadline,
 * observed tactics, and verification status. `validateFacts` guarantees one
 * entry per field, even if only a placeholder `'unknown'` value.
 */
export const REQUIRED_FACT_FIELDS = [
  'claimedIdentity',
  'centralClaim',
  'requestedAction',
  'amount',
  'payee',
  'deadline',
  'observedTactics',
  'verificationStatus',
] as const;

export type RequiredFactField = (typeof REQUIRED_FACT_FIELDS)[number];

/** One ordered transcript segment, as Gemini sees it: untrusted data only, never a system instruction. */
export interface FactSegmentInput {
  id: string;
  speaker: string;
  text: string;
}

/**
 * One field value Gemini proposes, before validation. Not yet trusted: a
 * `sourceSegmentIds` entry that does not cite a real segment, or an empty
 * citation list, is dropped by `validateFacts` before this ever becomes a
 * displayed `Fact`.
 */
export interface CandidateFact {
  field: string;
  value: string;
  sourceSegmentIds: string[];
  uncertainty: FactUncertainty;
}

/**
 * One displayed, source-linked fact. `supersededBy` is set on a `model`-origin
 * fact once the owner confirms or corrects that same field - the superseding
 * fact itself lives in `FactsProjection.confirmed`, so this is a provenance
 * breadcrumb, not a second trusted value. `modelVersion` is set only for
 * `model`-origin facts, identifying the prompt/schema version that produced it.
 */
export interface Fact {
  field: string;
  value: string;
  origin: FactOrigin;
  sourceSegmentIds: string[];
  modelVersion?: string;
  uncertainty: FactUncertainty;
  supersededBy?: FactOrigin;
}

/**
 * The case projection fields this feature adds on top of the foundation
 * `CaseEnvelope`. `facts` is Gemini's latest live (never trusted) view, one
 * entry per field, replaced wholesale on each extraction pass. `confirmed`
 * holds only user-affirmed facts (confirmed or corrected) and is the only
 * part of this projection any trusted-state decision (e.g. DSN-007/DSN-008)
 * may read.
 */
export interface FactsProjection extends CaseEnvelope {
  facts: Record<string, Fact>;
  confirmed: Record<string, Fact>;
}

/** One field-level comparison between the transcript and a proposed payment draft. */
export interface RelationFieldMatch {
  field: 'amountMinor' | 'beneficiaryId';
  matches: boolean;
  sourceSegmentIds: string[];
}

/**
 * Gemini's assessment of whether a controlled transcript actually directs
 * the specific proposed-payment draft it is compared against. Consumed by
 * DSN-008 (plan Task 6), which rejects the result outright if `draftEventId`,
 * `draftVersion`, or `inputCaseVersion` no longer match the draft/case it
 * promoted - the model never selects an action; it only reports whether the
 * transcript appears to request this already-proposed one.
 */
export interface CandidateRelation {
  segmentIds: string[];
  draftEventId: string;
  draftVersion: number;
  inputCaseVersion: number;
  directedAction: boolean;
  matches: RelationFieldMatch[];
}

/** Input to `GeminiPort.relate`: the draft and case versions it must be compared against, for staleness checks by the caller. */
export interface RelateInput {
  segments: FactSegmentInput[];
  draftEventId: string;
  draftVersion: number;
  inputCaseVersion: number;
  amountMinor: number;
  beneficiaryId: string;
}

/**
 * The model boundary. Implemented concretely by `apps/api/src/gemini.ts`
 * (real `@google/genai` adapter) and by an inline fake in tests. Never
 * selects actions or returns policy (DSN-007's job) and never emits a scam
 * probability or mental-state label.
 */
export interface GeminiPort {
  extract(segments: FactSegmentInput[]): Promise<CandidateFact[]>;
  relate(input: RelateInput): Promise<CandidateRelation>;
}
