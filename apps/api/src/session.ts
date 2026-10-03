import type { Firestore } from 'firebase-admin/firestore';
import type { CaseCommandResult } from '@dsn/contracts';
import type { SegmentInput, SessionProjection, TranscriptSegment } from '../../../packages/contracts/src/session.js';
import type { Plan } from '../../../packages/contracts/src/plan.js';

/** Raw transcript segments are a backstop-TTL'd ephemeral artifact; see `TranscriptSegment.expiresAt`. */
const SEGMENT_BACKSTOP_TTL_MS = 24 * 60 * 60 * 1000;

/** Invoked once per newly accepted (never replayed) segment, after its commit. */
export type OnSegmentCallback = (caseId: string, version: number) => void;

/**
 * Appends one ordered, consented transcript segment to a controlled session.
 *
 * Ownership and consent are checked inside the same transaction as the
 * write, mirroring `case-store.ts`'s ownership-before-idempotency ordering:
 * a non-owner always gets `FORBIDDEN`, never a hint about segment state.
 * Intake is gated on BOTH the owner's standing plan-level processing consent
 * and this case's own `sessionClosed` flag, so either turning processing off
 * in the Safety Plan or ending/revoking this specific session stops intake.
 *
 * A segment whose `id` was already accepted with identical content is an
 * idempotent replay: no new segment/event is written and `onSegment` is not
 * invoked again. A segment whose `id` was already accepted with DIFFERENT
 * content, or whose `order` is not exactly one past the last accepted order
 * (a gap, a reused/out-of-order index, or a resend under a new id), is
 * rejected as `ORDER_CONFLICT` - gaps and content conflicts are both, from
 * the caller's perspective, "this stream is no longer the one I expected",
 * so this module deliberately does not add a second error code for them.
 *
 * `onSegment` fires only after the transaction has actually committed a new
 * segment, never from a retried-but-ultimately-replayed attempt.
 */
export async function appendSegment(
  db: Firestore,
  uid: string,
  segment: SegmentInput,
  onSegment: OnSegmentCallback,
): Promise<{ acceptedOrder: number; caseVersion: number }> {
  const outcome = await db.runTransaction(async (tx) => {
    const caseRef = db.collection('cases').doc(segment.caseId);
    const segmentRef = caseRef.collection('segments').doc(segment.id);
    const eventRef = caseRef.collection('events').doc(segment.id);
    const planRef = db.collection('plans').doc(uid);

    const [caseSnap, planSnap] = await Promise.all([tx.get(caseRef), tx.get(planRef)]);
    if (!caseSnap.exists) {
      throw new Error('FORBIDDEN');
    }
    const current = caseSnap.data() as SessionProjection;
    if (current.ownerUid !== uid) {
      throw new Error('FORBIDDEN');
    }

    const plan = planSnap.exists ? (planSnap.data() as Plan) : undefined;
    if (!plan?.processingConsent || current.sessionClosed) {
      throw new Error('CONSENT_REQUIRED');
    }

    const segmentSnap = await tx.get(segmentRef);
    if (segmentSnap.exists) {
      const existing = segmentSnap.data() as TranscriptSegment;
      const identical = existing.order === segment.order && existing.speaker === segment.speaker && existing.text === segment.text;
      if (!identical) {
        throw new Error('ORDER_CONFLICT');
      }
      const eventSnap = await tx.get(eventRef);
      const receipt = eventSnap.get('result') as CaseCommandResult;
      return { acceptedOrder: existing.order, caseVersion: receipt.version, replay: true as const };
    }

    const lastSegmentOrder = current.lastSegmentOrder ?? 0;
    if (segment.order !== lastSegmentOrder + 1) {
      throw new Error('ORDER_CONFLICT');
    }

    const now = new Date();
    const fullSegment: TranscriptSegment = { ...segment, expiresAt: new Date(now.getTime() + SEGMENT_BACKSTOP_TTL_MS).toISOString() };
    const nextVersion = current.version + 1;
    const receipt: CaseCommandResult = { id: current.id, version: nextVersion, phase: current.phase };

    tx.create(segmentRef, fullSegment);
    tx.create(eventRef, {
      id: segment.id,
      caseId: segment.caseId,
      actorUid: uid,
      kind: 'segment-accepted',
      at: now.toISOString(),
      causationId: segment.id,
      policyVersion: 'cup-core-1',
      refs: [segment.id],
      result: receipt,
    });
    tx.update(caseRef, { lastSegmentOrder: segment.order, version: nextVersion, updatedAt: now.toISOString() });

    return { acceptedOrder: segment.order, caseVersion: nextVersion, replay: false as const };
  });

  if (!outcome.replay) {
    onSegment(segment.caseId, outcome.caseVersion);
  }
  return { acceptedOrder: outcome.acceptedOrder, caseVersion: outcome.caseVersion };
}

/**
 * Withdraws processing consent for this specific controlled session: sets
 * `sessionClosed` so every subsequent `appendSegment` call rejects with
 * `CONSENT_REQUIRED`. Unlike `endSession`, this does not purge raw segments -
 * revocation only stops further intake. Idempotent: calling it again after
 * the session is already closed is a no-op (no extra version bump).
 */
export async function revokeProcessing(db: Firestore, uid: string, caseId: string): Promise<void> {
  await db.runTransaction(async (tx) => {
    const caseRef = db.collection('cases').doc(caseId);
    const snap = await tx.get(caseRef);
    if (!snap.exists) {
      throw new Error('FORBIDDEN');
    }
    const current = snap.data() as SessionProjection;
    if (current.ownerUid !== uid) {
      throw new Error('FORBIDDEN');
    }
    if (current.sessionClosed) {
      return;
    }
    tx.update(caseRef, { sessionClosed: true, version: current.version + 1, updatedAt: new Date().toISOString() });
  });
}

/**
 * Internal-only session end: stops further intake (same `sessionClosed`
 * gate as `revokeProcessing`) AND synchronously purges every raw segment
 * document, so no raw transcript text survives the call. There is
 * deliberately no public HTTP route for this in this task - Task 11
 * (DSN-013) owns the sole close command and calls this only after its own
 * evidence-promotion/retention preparation. Idempotent: closing an
 * already-closed session purges nothing further and does not re-bump
 * `version`.
 */
export async function endSession(db: Firestore, uid: string, caseId: string): Promise<void> {
  const caseRef = db.collection('cases').doc(caseId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(caseRef);
    if (!snap.exists) {
      throw new Error('FORBIDDEN');
    }
    const current = snap.data() as SessionProjection;
    if (current.ownerUid !== uid) {
      throw new Error('FORBIDDEN');
    }
    if (current.sessionClosed) {
      return;
    }
    const segmentsSnap = await tx.get(caseRef.collection('segments'));
    for (const doc of segmentsSnap.docs) {
      tx.delete(doc.ref);
    }
    tx.update(caseRef, { sessionClosed: true, version: current.version + 1, updatedAt: new Date().toISOString() });
  });
}
