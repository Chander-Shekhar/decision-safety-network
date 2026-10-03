// Controlled-session contract (plan Task 3 / DSN-005). Mirrors case.ts and
// plan.ts's split: this file holds only types; Firestore-touching intake and
// revocation logic lives in apps/api/src/{session,session-routes}.ts and must
// not be duplicated here.

import type { CaseEnvelope } from './case.js';

/**
 * One accepted segment of the controlled, incrementally streamed transcript.
 * `expiresAt` is a server-computed backstop TTL on the raw segment document -
 * it is NOT the retention policy (Task 11 owns that); it only bounds how long
 * an abandoned session's raw text can survive if neither `revokeProcessing`
 * nor the eventual close ever runs.
 */
export interface TranscriptSegment {
  id: string;
  caseId: string;
  /** 1-based position in the controlled stream; must arrive gap-free and in order. */
  order: number;
  speaker: string;
  text: string;
  expiresAt: string;
}

/**
 * What a caller supplies to `appendSegment`. `expiresAt` is deliberately
 * excluded - the server computes it, never the browser.
 */
export type SegmentInput = Omit<TranscriptSegment, 'expiresAt'>;

/**
 * The case projection fields this feature adds on top of the foundation
 * `CaseEnvelope`. Both fields default to "no segments yet" / "not closed"
 * when absent, since `case-store.ts`'s `createCase` does not set them.
 */
export interface SessionProjection extends CaseEnvelope {
  /** Highest accepted segment order so far; 0 (or absent) means none yet. */
  lastSegmentOrder?: number;
  /**
   * Set by either `revokeProcessing` (processing consent withdrawn for this
   * session) or the internal `endSession` (session ending/closing). Once
   * true, `appendSegment` always rejects with `CONSENT_REQUIRED` - the two
   * causes are deliberately indistinguishable from the intake gate's point
   * of view; only `endSession` additionally purges raw segments.
   */
  sessionClosed?: boolean;
}
