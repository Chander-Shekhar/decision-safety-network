// Same-case already-paid recovery contract (plan Task 10 / DSN-012). Mirrors
// case.ts and payment.ts's split: this file holds only types; Firestore-
// touching entry, prefill, and paid-detail confirmation logic lives in
// apps/api/src/{recovery,recovery-routes}.ts and must not be duplicated here.
//
// Trust rule: a proposed payment (a simulated draft or a user-confirmed
// caller request) is NEVER an actual paid payment. `PaidPayment` exists only
// after the owner explicitly matches or edits the paid details.

import type { CaseEnvelope } from './case.js';
import type { Fact } from './facts.js';
import type { PaymentDraft } from './payment.js';

/** Where a labeled prefill came from. Never both; a retained simulated draft wins. */
export type PrefillSource = 'simulated-draft' | 'caller-request';

/**
 * A labeled, never-authoritative prefill of what was proposed. `fingerprint`
 * is a server-generated digest of the exact source and values shown, so a
 * "Yes, they match" click can be rejected (`STALE_PREFILL`) if what the owner
 * saw is no longer current. `sourceRetained` is false when the raw source
 * (transcript or draft) no longer exists, e.g. after default 24-hour close.
 */
export interface PaymentPrefill {
  source: PrefillSource;
  sourceLabel: string;
  sourceRetained: boolean;
  payee: string;
  amountMinor: number;
  fingerprint: string;
}

/** What the owner reported actually left their account. Always `user-reported`. */
export interface PaidPayment {
  paidPayee: string;
  paidAmountMinor: number;
  transactionTime?: string;
  paymentRail?: string;
  referenceId?: string;
  origin: 'user-reported';
}

export type PaidField = 'paidPayee' | 'paidAmountMinor' | 'transactionTime' | 'paymentRail' | 'referenceId';

/** Bank/provider first-hour route. Fictional Demo Bank; any acknowledgement is local and simulated. */
export interface BankAction {
  status: 'ready';
  route: 'Demo Bank';
  simulated: true;
}

/** The real public 1930 / cybercrime.gov.in route: source-dated, NOT simulated. */
export interface Helpline1930Action {
  status: 'ready';
  route: '1930';
  sourceUrl: 'https://cybercrime.gov.in/';
  reviewedAt: '2026-10-02';
}

/** A local status note. Never proof of an official filing or receipt. */
export interface RecoveryAcknowledgement {
  action: 'bank' | 'helpline-1930';
  status: 'local-note-recorded';
  simulated: true;
  at: string;
}

export interface RecoveryKnown {
  /** Owner-confirmed facts (claimed identity, claim, requested action, payee, amount, deadline) reused as context. */
  facts: Record<string, string>;
  evidenceIds: string[];
}

export interface RecoveryState {
  caseId: string;
  known: RecoveryKnown;
  proposedPayment: PaymentPrefill | null;
  paidPayment: PaidPayment | null;
  missing: PaidField[];
  bankAction: BankAction;
  helpline1930Action: Helpline1930Action;
  acknowledgement: RecoveryAcknowledgement | null;
}

/**
 * The case projection fields this feature reads/adds. `confirmed.paidPayment`
 * is stored in the retention-compatible user-reported shape (see
 * evidence.ts's `RetainedPaidPayment`) so the 24-hour mode preserves it.
 */
export interface RecoveryProjection extends CaseEnvelope {
  confirmed: Record<string, Fact>;
  paymentDraft?: PaymentDraft;
  recoveryAcknowledgement?: RecoveryAcknowledgement;
}
