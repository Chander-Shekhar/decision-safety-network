// Safety Plan contract (plan Task 2 / DSN-004). Mirrors case.ts's split:
// this file holds types and a pure, I/O-free default-filling constructor;
// Firestore-touching logic (save/invite/accept/revoke) lives in
// apps/api/src/{plan,ally-pairing}.ts and must not be duplicated here.

/**
 * How long case content survives after the session closes. `facts-24h` is
 * the disclosed default: user-confirmed facts only, no raw transcript.
 */
export type RetentionMode = 'delete-on-close' | 'facts-24h' | 'selected-7d';

/**
 * The owner's saved Safety Plan: a context-aware transfer threshold, the
 * (always fictional) Demo Bank route, and four separate, independently
 * revocable consents. `nominatedAllyUid` records who the owner nominated via
 * a consumed pairing code; nomination is not readiness - see
 * `hasAcceptedRelationship` in apps/api/src/plan.ts.
 */
export interface Plan {
  ownerUid: string;
  version: number;
  thresholdMinor: number;
  bankId: 'demo-bank';
  processingConsent: boolean;
  retentionMode: RetentionMode;
  allySharingConsent: boolean;
  exportConsent: boolean;
  nominatedAllyUid?: string;
}

/** Input to `createPlan`. Every consent and the retention mode default to the safe/disclosed baseline when omitted. */
export interface CreatePlanInput {
  ownerUid?: string;
  version?: number;
  thresholdMinor: number;
  bankId: 'demo-bank';
  processingConsent?: boolean;
  retentionMode?: RetentionMode;
  allySharingConsent?: boolean;
  exportConsent?: boolean;
  nominatedAllyUid?: string;
}

/**
 * Pure constructor for a `Plan`, filling undeclared consents/retention with
 * their safe defaults. Takes no `db`; callers that persist a plan
 * (apps/api/src/plan.ts's `savePlan`) call this and then write the result.
 */
export function createPlan(input: CreatePlanInput): Plan {
  const plan: Plan = {
    ownerUid: input.ownerUid ?? '',
    version: input.version ?? 1,
    thresholdMinor: input.thresholdMinor,
    bankId: input.bankId,
    processingConsent: input.processingConsent ?? false,
    retentionMode: input.retentionMode ?? 'facts-24h',
    allySharingConsent: input.allySharingConsent ?? false,
    exportConsent: input.exportConsent ?? false,
  };
  if (input.nominatedAllyUid !== undefined) {
    plan.nominatedAllyUid = input.nominatedAllyUid;
  }
  return plan;
}

/**
 * A detail-free invitation from `ownerUid` to a nominated `allyUid`. Carries
 * no case data - only identity and the two lifecycle timestamps. Nomination
 * is not readiness: an unaccepted invitation must not be treated as an
 * active relationship (see `hasAcceptedRelationship`).
 *
 * `revokedAt` must be written as an explicit `null` (never left unset) on
 * creation: `hasAcceptedRelationship`'s query filters
 * `.where('revokedAt', '==', null)`, and Firestore does not match documents
 * where the field is simply absent.
 */
export interface AllyInvitation {
  id: string;
  ownerUid: string;
  allyUid: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
}
