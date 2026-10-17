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
 * Plan contract version. v1 = threshold/route/consents/retention/nomination.
 * v2 (DSN-023) additively adds `callListening`, `allyShareFields`,
 * `bankAccounts`, `setupCompletedAt`. Documents written before v2 lack these
 * fields; always read through `normalizePlan`, never trust raw snapshots.
 */
export const PLAN_CONTRACT_VERSION = 2;

/**
 * When the owner wants calls listened to: every call, only numbers not
 * already verified, or an explicit choice at each pickup (the safe default).
 * Read by the downstream screening/session flow.
 */
export type CallListeningMode = 'all-calls' | 'unverified-only' | 'per-call';
export const CALL_LISTENING_MODES: readonly CallListeningMode[] = ['all-calls', 'unverified-only', 'per-call'];

/** Case-info fields the owner pre-approves for ally preview; mirrors `AllyPacketContent` keys. A later case-specific grant is still required. */
export type AllyShareField = 'claim' | 'proposedAction' | 'amount' | 'verificationGap' | 'summary';
export const ALLY_SHARE_FIELDS: readonly AllyShareField[] = ['claim', 'proposedAction', 'amount', 'verificationGap', 'summary'];
export const DEFAULT_ALLY_SHARE_FIELDS: readonly AllyShareField[] = ['claim', 'proposedAction', 'amount', 'verificationGap', 'summary'];

/** A registered account for later guided protection. Synthetic/demo only: never a real linked account; `last4` is display-only. */
export interface RegisteredBankAccount {
  id: string;
  label: string;
  last4: string;
}

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
  /** v2 */
  contractVersion: number;
  callListening: CallListeningMode;
  allyShareFields: AllyShareField[];
  bankAccounts: RegisteredBankAccount[];
  /** ISO timestamp; present once first-run setup is complete ("configured"). */
  setupCompletedAt?: string;
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
  callListening?: CallListeningMode;
  allyShareFields?: AllyShareField[];
  bankAccounts?: RegisteredBankAccount[];
  setupCompletedAt?: string;
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
    contractVersion: PLAN_CONTRACT_VERSION,
    callListening: input.callListening ?? 'per-call',
    allyShareFields: [...(input.allyShareFields ?? DEFAULT_ALLY_SHARE_FIELDS)],
    bankAccounts: [...(input.bankAccounts ?? [])],
  };
  if (input.nominatedAllyUid !== undefined) {
    plan.nominatedAllyUid = input.nominatedAllyUid;
  }
  if (input.setupCompletedAt !== undefined) {
    plan.setupCompletedAt = input.setupCompletedAt;
  }
  return plan;
}

/**
 * Upgrades any stored plan document (v1 or v2) to the current shape by
 * filling v2 defaults. Pure; the one sanctioned way for the screening/session
 * flow to read `callListening` and the other v2 fields.
 */
export function normalizePlan(raw: Partial<Plan> & Pick<Plan, 'thresholdMinor' | 'bankId'>): Plan {
  return createPlan({
    ownerUid: raw.ownerUid,
    version: raw.version,
    thresholdMinor: raw.thresholdMinor,
    bankId: raw.bankId,
    processingConsent: raw.processingConsent,
    retentionMode: raw.retentionMode,
    allySharingConsent: raw.allySharingConsent,
    exportConsent: raw.exportConsent,
    nominatedAllyUid: raw.nominatedAllyUid,
    callListening: raw.callListening,
    allyShareFields: raw.allyShareFields,
    bankAccounts: raw.bankAccounts,
    setupCompletedAt: raw.setupCompletedAt,
  });
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
  /** Owner read only: the ally's self-entered display name, joined at read time. */
  allyName?: string;
}
