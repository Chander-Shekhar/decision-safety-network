// Evidence, export, and retention contract (plan Task 11 / DSN-013). Mirrors
// case.ts and plan.ts's split: this file holds only types; Firestore-touching
// promotion, close, delete, sweep, and export logic lives in
// apps/api/src/{retention,retention-routes,export,evidence-routes}.ts and
// must not be duplicated here.

import type { CaseEnvelope } from './case.js';
import type { RetentionMode } from './plan.js';

export type { RetentionMode };

/**
 * A user-selected transcript excerpt, promoted by its owner before close so
 * it survives under `selected-7d` retention. Lives at
 * `cases/{caseId}/evidence/{segmentId}` - the doc id is always the source
 * segment id, which makes re-promotion naturally idempotent.
 */
export interface EvidenceExcerpt {
  id: string;
  caseId: string;
  segmentId: string;
  speaker: string;
  text: string;
  order: number;
  promotedAt: string;
}

/**
 * One confirmed fact's retained shape, once a case has closed under
 * `facts-24h` or `selected-7d`. Deliberately NOT the live `Fact`
 * (packages/contracts/src/facts.ts) - that type tracks live trust during an
 * open case; this records what survived retention, with field names chosen
 * so the two are never confused (`sourceIds`, `provenanceLabel`).
 * `sourceRetained` is computed once, at close/prune time, so later reads and
 * the export manifest never have to recompute it.
 */
export interface RetainedFact {
  value: string;
  origin: string;
  sourceRetained: boolean;
  sourceIds: string[];
  provenanceLabel: 'source not retained' | 'selected evidence';
  correctedAt: string | null;
}

/**
 * A user-reported paid-payment fact (plan Task 10/DSN-012's "what actually
 * left the account", confirmed only by the owner's explicit match/edit -
 * never Gemini's proposed draft). `facts.ts`'s sealed `FactOrigin` union has
 * no value for this ("user-reported" is not one of its three members), so
 * this is defined here rather than widening that union.
 */
export interface RetainedPaidPayment {
  payeeId: string;
  amountMinor: number;
  origin: 'user-reported';
  provenanceLabel: 'source not retained';
  sourceIds: string[];
  correctedAt: null;
  reportedAt: string;
}

/** The retained/exported form of a case's confirmed facts once closed. */
export type RetainedConfirmed = Record<string, RetainedFact | RetainedPaidPayment>;

/**
 * The exact case-document field set a closed (`facts-24h`/`selected-7d`)
 * case carries - see `closeSessionWithRetention`'s allowlisted final write.
 * `delete-on-close` never reaches this shape; the case document is removed
 * outright instead.
 */
export interface RetainedCaseProjection extends CaseEnvelope {
  exportConsent: boolean;
  retentionMode: RetentionMode;
  confirmed: RetainedConfirmed;
}

/**
 * An unlinkable record that a case's content was deleted. Its random `id`
 * (never the deleted case's own id) and single `completedAt` field are the
 * only trace left after `deleteCaseContent` - nothing here can be joined
 * back to the case or its owner.
 */
export interface DeletionTombstone {
  completedAt: string;
}

/**
 * One manifest-flattened fact, as `buildExportZip`'s `provenance.json` and
 * `brief.html` render it. `field` is the confirmed-facts map key promoted
 * into the value; everything else is copied straight from the matching
 * `RetainedFact`.
 */
export interface ManifestFact {
  field: string;
  value: string;
  origin: string;
  sourceIds: string[];
  provenanceLabel: string;
  correctedAt: string | null;
}
