// Open-web claim-verification evidence contract (DSN-026 / PRD C7). Types only;
// lookup, normalization, and persistence live in apps/api/src/web-verification*.ts.
//
// Trust rule: this is LABELED, UNTRUSTED supporting evidence. It can
// corroborate or contradict a caller's claim, but it carries no official
// route and never certifies a caller; the literal types below make violating
// that unrepresentable. The actionable route still comes only from the
// curated Demo Bank registry (`verifyWithDemoBank`).

/** Whether public information supports, undermines, or says nothing about the claim. */
export type WebEvidenceStance = 'corroborates' | 'contradicts' | 'inconclusive';

export interface WebVerificationEvidence {
  stance: WebEvidenceStance;
  /** Display name from the server's curated institution table; null when the claimed identity is not recognized. Never provider text. */
  institution: string | null;
  /** Masked display form of the number checked. */
  maskedNumber: string;
  /** Server-templated one-line label. Never provider text. */
  headline: string;
  detail: string;
  /** Always untrusted supporting evidence. */
  trust: 'untrusted';
  /** `curated-sample` = deterministic bundled data; `grounded-web` = a live grounded provider (not enabled in the Cup build). */
  source: 'curated-sample' | 'grounded-web';
  simulated: true;
  /** Web evidence can never supply or alter the official route, nor certify the caller. */
  officialRoute: null;
  certifiesCaller: false;
  checkedAt: string;
}
