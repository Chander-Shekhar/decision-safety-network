// Pre-pickup caller screening contract (DSN-024 / PRD C2, C13). Types only;
// Firestore and adapter logic live in apps/api/src/{screening,fraud-list}*.ts.
//
// Trust rule: every field here is advisory, UNTRUSTED evidence. A verdict
// carries no official route and never certifies a caller; the literal types
// below make that unrepresentable to violate.

/** What a third-party caller-ID / reputation provider reports for a number. */
export type CallerIdCategory = 'spam-reported' | 'unknown' | 'no-signal';

/** Normalized provider signal. Free text from the provider is never carried through. */
export interface CallerIdSignal {
  category: CallerIdCategory;
  /** Provider-reported count of user reports; display-only. */
  reportCount?: number;
}

export type ScreeningLevel = 'none' | 'unverified' | 'previously-reported';

/** How the owner's `callListening` preference applies to this call. */
export type ListeningDecision = 'listen' | 'ask';

/** Basis for adding an identifier to the private list (C13). Never a raw signal. */
export type FraudListBasis = 'user-confirmed' | 'authority-report';

export interface ScreeningVerdict {
  level: ScreeningLevel;
  /** True when a warning should be shown before pickup. A clean number warns nothing. */
  warn: boolean;
  /** Masked display form of the screened number. */
  maskedNumber: string;
  headline: string | null;
  detail: string | null;
  /** True only when the owner's own private list matched. Warns the recipient only. */
  previouslyReported: boolean;
  signal: CallerIdSignal;
  listening: ListeningDecision;
  /** Always untrusted supporting evidence; always simulated in the Cup build. */
  trust: 'untrusted';
  simulated: true;
  /** Screening can never supply or alter the official route, nor certify the caller. */
  officialRoute: null;
  certifiesCaller: false;
}

export interface FraudListEntry {
  id: string;
  maskedNumber: string;
  basis: FraudListBasis;
  caseId: string;
  addedAt: string;
}
