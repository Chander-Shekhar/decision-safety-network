// Retention, close, delete, and sweep logic for Task 11 (DSN-013). This is
// the sole place that implements the three retention modes
// (`delete-on-close`, `facts-24h`, `selected-7d`); `evidence-routes.ts` and
// `retention-routes.ts` only translate HTTP in and out of these functions.
import type { CollectionReference, DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { CaseEnvelope } from '@dsn/contracts';
import type { Fact } from '../../../packages/contracts/src/facts.js';
import type { RetentionMode } from '../../../packages/contracts/src/plan.js';
import type {
  DeletionTombstone,
  EvidenceExcerpt,
  RetainedCaseProjection,
  RetainedConfirmed,
  RetainedFact,
  RetainedPaidPayment,
} from '../../../packages/contracts/src/evidence.js';
import type { TranscriptSegment } from '../../../packages/contracts/src/session.js';
import { endSession } from './session.js';

const DELETE_BATCH_SIZE = 200;
const FACTS_24H_MS = 24 * 60 * 60 * 1000;
const SELECTED_7D_MS = 7 * 24 * 60 * 60 * 1000;

interface CloseCapableCase extends CaseEnvelope {
  sessionClosed?: boolean;
  closing?: boolean;
  closingMode?: RetentionMode;
  retentionMode?: RetentionMode;
  exportConsent?: boolean;
  confirmed?: Record<string, Fact | RetainedPaidPayment>;
}

function caseRef(db: Firestore, caseId: string) {
  return db.collection('cases').doc(caseId);
}

/** Rejects a mutation on a case already past its logical `expiresAt` (awaiting the sweep), so a mutator can never rewrite or resurrect it. */
function assertNotExpired(current: { expiresAt?: string }): void {
  if (current.expiresAt !== undefined && current.expiresAt <= new Date().toISOString()) {
    throw new Error('EXPIRED');
  }
}

/** Test seam: lets a test interleave a concurrent writer right before the prune's final transactional write. */
export interface CloseHooks {
  beforeFinalWrite?: () => Promise<void>;
}

/** True once a case has fully converged on a close under `mode` - see the final allowlisted write in `pruneToRetained`/`deleteCaseContent`'s outright removal. */
function hasConverged(current: CloseCapableCase): boolean {
  return current.closing !== true && typeof current.retentionMode === 'string';
}

/**
 * Marks the case as closing (recording the chosen mode so a retry can detect
 * a mode mismatch), or confirms an already-converged close used the same
 * mode. Transactional so two concurrent close calls can't both proceed with
 * different modes.
 */
async function markClosing(db: Firestore, uid: string, caseId: string, mode: RetentionMode): Promise<{ alreadyConverged: boolean }> {
  return db.runTransaction(async (tx) => {
    const ref = caseRef(db, caseId);
    const snap = await tx.get(ref);
    if (!snap.exists) {
      // A completed delete-on-close removes the case document itself, so a
      // retry of that same close finds nothing left: converged, not an error.
      // Any other mode has no such terminal absence, so stays FORBIDDEN.
      if (mode === 'delete-on-close') {
        return { alreadyConverged: true };
      }
      throw new Error('FORBIDDEN');
    }
    const current = snap.data() as CloseCapableCase;
    if (current.ownerUid !== uid) {
      throw new Error('FORBIDDEN');
    }

    if (hasConverged(current)) {
      if (current.retentionMode !== mode) {
        throw new Error('MODE_MISMATCH');
      }
      return { alreadyConverged: true };
    }

    if (current.closing === true && current.closingMode !== mode) {
      throw new Error('MODE_MISMATCH');
    }

    tx.update(ref, { closing: true, closingMode: mode, version: current.version + 1, updatedAt: new Date().toISOString() });
    return { alreadyConverged: false };
  });
}

/**
 * Deletes every document in `collectionRef` in bounded pages. Re-queries
 * rather than deleting a fixed id list, so a crash mid-delete is naturally
 * resumable on retry (the next page just picks up whatever is still there).
 */
async function deleteCollection(db: Firestore, collectionRef: CollectionReference): Promise<void> {
  for (;;) {
    const page = await collectionRef.limit(DELETE_BATCH_SIZE).get();
    if (page.empty) {
      return;
    }
    const batch = db.batch();
    for (const doc of page.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    if (page.size < DELETE_BATCH_SIZE) {
      return;
    }
  }
}

/** Deletes every subcollection of a case except those named in `keep`, discovered via `listCollections()` so a future child collection can never silently leak. */
async function deleteSubcollections(db: Firestore, ref: DocumentReference, keep: readonly string[] = []): Promise<void> {
  for (const child of await ref.listCollections()) {
    if (!keep.includes(child.id)) {
      await deleteCollection(db, child);
    }
  }
}

function isPaidPayment(value: Fact | RetainedPaidPayment | RetainedFact): value is RetainedPaidPayment {
  return 'reportedAt' in value;
}

/**
 * Builds the retained-facts projection from a case's live `confirmed` map.
 * `retainedSegmentIds` is the set of segment ids whose excerpt survived into
 * `evidence` (always empty under `facts-24h`, since that mode deletes the
 * `evidence` subcollection outright) - a fact is `selected evidence` only if
 * ALL of its citing segments are in that set and there is at least one.
 * A user-reported `paidPayment` fact is preserved unconditionally and is
 * never subject to the segment-citation check (it was never segment-sourced
 * to begin with).
 */
export function buildRetainedConfirmed(confirmed: Record<string, Fact | RetainedPaidPayment> | undefined, retainedSegmentIds: ReadonlySet<string>): RetainedConfirmed {
  const result: RetainedConfirmed = {};
  for (const [field, value] of Object.entries(confirmed ?? {})) {
    if (isPaidPayment(value)) {
      result[field] = {
        payeeId: value.payeeId,
        amountMinor: value.amountMinor,
        origin: 'user-reported',
        provenanceLabel: 'source not retained',
        sourceIds: [],
        correctedAt: null,
        reportedAt: value.reportedAt,
      };
      continue;
    }
    const sourceIds = value.sourceSegmentIds ?? [];
    const retained = sourceIds.length > 0 && sourceIds.every((id) => retainedSegmentIds.has(id));
    result[field] = {
      value: value.value,
      origin: value.origin,
      sourceRetained: retained,
      sourceIds: retained ? sourceIds : [],
      provenanceLabel: retained ? 'selected evidence' : 'source not retained',
      correctedAt: null,
    };
  }
  return result;
}

/** Reads the owner's live plan export-consent value, defaulting to false if the plan is somehow missing (never silently grant export). */
async function readLiveExportConsent(db: Firestore, ownerUid: string): Promise<boolean> {
  const snap = await db.collection('plans').doc(ownerUid).get();
  return snap.exists ? Boolean(snap.get('exportConsent')) : false;
}

/**
 * Prunes a closing case down to its retained shape under `facts-24h` or
 * `selected-7d`. Re-reads the case fresh (rather than trusting the snapshot
 * `markClosing` saw) so a retry after a partial prior prune still computes
 * retained-ness from current state. Deletes `events`/`allyGrants`/`segments`
 * always, and `evidence` too under `facts-24h` (nothing can ever be "selected
 * evidence" in that mode). The final `.set()` (not `.update()`) replaces the
 * whole document with exactly the allowlisted shape, which is what naturally
 * drops the transient `closing`/`closingMode`/`sessionClosed`/
 * `lastSegmentOrder` fields without a separate cleanup step.
 */
async function pruneToRetained(db: Firestore, uid: string, caseId: string, mode: 'facts-24h' | 'selected-7d', hooks: CloseHooks = {}): Promise<void> {
  const ref = caseRef(db, caseId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error('FORBIDDEN');
  }
  const current = snap.data() as CloseCapableCase;
  if (current.ownerUid !== uid) {
    throw new Error('FORBIDDEN');
  }

  let retainedSegmentIds = new Set<string>();
  if (mode === 'selected-7d') {
    const evidenceSnap = await ref.collection('evidence').get();
    retainedSegmentIds = new Set(evidenceSnap.docs.map((d) => d.id));
  }

  // Everything except the (selected-7d) evidence excerpts goes, including any
  // child collection added in future.
  await deleteSubcollections(db, ref, mode === 'selected-7d' ? ['evidence'] : []);

  const confirmed = buildRetainedConfirmed(current.confirmed, retainedSegmentIds);
  const exportConsent = await readLiveExportConsent(db, current.ownerUid);
  const now = new Date();
  const ttlMs = mode === 'facts-24h' ? FACTS_24H_MS : SELECTED_7D_MS;

  const retainedProjection: RetainedCaseProjection = {
    id: current.id,
    ownerUid: current.ownerUid,
    version: current.version + 1,
    phase: current.phase,
    planVersion: current.planVersion,
    createdAt: current.createdAt,
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    exportConsent,
    retentionMode: mode,
    confirmed,
  };

  await hooks.beforeFinalWrite?.();

  // Transactional re-check: the plain `.get()` above is stale by now. Only
  // write if the case is still ours to prune (`closing`) and no other writer
  // advanced `version` since we read it; otherwise fail retryably instead of
  // clobbering (or resurrecting state on) a concurrently-written document.
  await db.runTransaction(async (tx) => {
    const latestSnap = await tx.get(ref);
    if (!latestSnap.exists) {
      throw new Error('FORBIDDEN');
    }
    const latest = latestSnap.data() as CloseCapableCase;
    if (latest.closing !== true || latest.version !== current.version) {
      throw new Error('CONCURRENT_MODIFICATION');
    }
    tx.set(ref, { ...retainedProjection, version: latest.version + 1 });
  });
}

/**
 * The sole close operation (Task 11's one HTTP-reachable close command).
 * Retry-safe: `markClosing` is the only step that can throw `MODE_MISMATCH`;
 * every step after it is individually idempotent, so a crash between any two
 * steps converges correctly when the same call is repeated with the same
 * mode. `endSession` purges segments and raw transcript text; the mode-
 * specific step then prunes or deletes everything else.
 */
export async function closeSessionWithRetention(db: Firestore, uid: string, caseId: string, mode: RetentionMode, hooks: CloseHooks = {}): Promise<void> {
  const { alreadyConverged } = await markClosing(db, uid, caseId, mode);
  if (alreadyConverged) {
    return;
  }

  await endSession(db, uid, caseId);

  if (mode === 'delete-on-close') {
    await deleteCaseContent(db, uid, caseId);
    return;
  }

  await pruneToRetained(db, uid, caseId, mode, hooks);
}

/**
 * Deletes a case's content outright: writes an unlinkable tombstone BEFORE
 * deleting any descendant or the case document itself, so a crash-and-retry
 * can never leave a deleted case with zero tombstones. The tombstone's
 * random id is never the case id and it carries only `completedAt` - nothing
 * about it can be joined back to the case or its owner. This ordering
 * deliberately accepts an at-least-once tombstone (a retried deletion after
 * a crash may legitimately write a second one) as the cost of true
 * unlinkability: a tombstone keyed by caseId would defeat the point.
 */
export async function deleteCaseContent(db: Firestore, uid: string, caseId: string): Promise<void> {
  const ref = caseRef(db, caseId);
  const snap = await ref.get();
  if (!snap.exists) {
    // Already fully deleted by an earlier (possibly interrupted-then-retried) call: converged.
    return;
  }
  const current = snap.data() as CloseCapableCase;
  if (current.ownerUid !== uid) {
    throw new Error('FORBIDDEN');
  }

  const tombstone: DeletionTombstone = { completedAt: new Date().toISOString() };
  await db.collection('deletionTombstones').doc().set(tombstone);

  await deleteSubcollections(db, ref);
  await ref.delete();
}

/**
 * Pages through cases whose `expiresAt` has already passed and physically
 * deletes each one via `deleteCaseContent`. Firestore's own TTL policy is a
 * backup only - this is what actually enforces the 24h/7d retention window
 * promptly. Converges because each deletion shrinks the matched set.
 */
export async function sweepExpiredCases(
  db: Firestore,
  now: () => Date,
  deleteCase: (db: Firestore, uid: string, caseId: string) => Promise<void> = deleteCaseContent,
): Promise<{ swept: number; failed: number }> {
  const PAGE_SIZE = 50;
  let swept = 0;
  let failed = 0;
  for (;;) {
    const nowIso = now().toISOString();
    const page = await db.collection('cases').where('expiresAt', '<=', nowIso).limit(PAGE_SIZE).get();
    if (page.empty) {
      return { swept, failed };
    }
    let sweptThisPage = 0;
    for (const doc of page.docs) {
      const data = doc.data() as CaseEnvelope;
      // One poison case must not block the rest of the sweep.
      try {
        await deleteCase(db, data.ownerUid, doc.id);
        swept += 1;
        sweptThisPage += 1;
      } catch (error) {
        failed += 1;
        console.error(`retention sweep: failed to delete case ${doc.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    // A page that made no progress would re-match the same failing cases forever.
    if (page.size < PAGE_SIZE || sweptThisPage === 0) {
      return { swept, failed };
    }
  }
}

/**
 * Promotes one segment into the case's `evidence` subcollection so it
 * survives under `selected-7d`. The evidence doc id is always the segment
 * id, so re-promoting the same segment is a pure no-op (idempotent by doc
 * id) rather than a new write.
 */
export async function promoteEvidence(db: Firestore, uid: string, caseId: string, segmentId: string): Promise<EvidenceExcerpt> {
  return db.runTransaction(async (tx) => {
    const ref = caseRef(db, caseId);
    const segmentRef = ref.collection('segments').doc(segmentId);
    const evidenceRef = ref.collection('evidence').doc(segmentId);

    const [caseSnap, segmentSnap, evidenceSnap] = await Promise.all([tx.get(ref), tx.get(segmentRef), tx.get(evidenceRef)]);
    if (!caseSnap.exists) {
      throw new Error('FORBIDDEN');
    }
    const current = caseSnap.data() as CloseCapableCase;
    if (current.ownerUid !== uid) {
      throw new Error('FORBIDDEN');
    }
    assertNotExpired(current);
    if (current.sessionClosed === true || current.closing === true) {
      throw new Error('SESSION_CLOSED');
    }

    if (evidenceSnap.exists) {
      return evidenceSnap.data() as EvidenceExcerpt;
    }

    if (!segmentSnap.exists) {
      throw new Error('SEGMENT_NOT_FOUND');
    }
    const segment = segmentSnap.data() as TranscriptSegment;
    const excerpt: EvidenceExcerpt = {
      id: segment.id,
      caseId,
      segmentId: segment.id,
      speaker: segment.speaker,
      text: segment.text,
      order: segment.order,
      promotedAt: new Date().toISOString(),
    };
    tx.create(evidenceRef, excerpt);
    return excerpt;
  });
}

/**
 * Reads back the requested evidence excerpts by id, silently skipping any
 * id that doesn't exist. Deliberately takes no `uid` - per the plan's own
 * signature, ownership is the CALLER's responsibility (mirrors
 * `fact-routes.ts`'s `readOrderedSegments` convention); every route that
 * calls this authorizes the request itself first (see `evidence-routes.ts`,
 * which calls `readCase` before this).
 */
export async function readSelectedEvidence(db: Firestore, caseId: string, ids: readonly string[]): Promise<EvidenceExcerpt[]> {
  const ref = caseRef(db, caseId).collection('evidence');
  const snaps = await Promise.all(ids.map((id) => ref.doc(id).get()));
  return snaps.filter((snap) => snap.exists).map((snap) => snap.data() as EvidenceExcerpt);
}

/**
 * Revokes export consent on this specific case's own snapshot. Scoped
 * deliberately to the case document only - the owner's Plan document
 * (`plan.ts`/`plan-routes.ts`) is out of this task's owned paths, so a
 * pre-close case's "live" export consent still comes from the Plan (see
 * `pruneToRetained`'s own live-plan read and `export.ts`'s consent check);
 * this function is primarily meaningful on an already-closed case, which
 * carries its own `exportConsent` snapshot.
 */
export async function revokeExportConsent(db: Firestore, uid: string, caseId: string): Promise<void> {
  await db.runTransaction(async (tx) => {
    const ref = caseRef(db, caseId);
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error('FORBIDDEN');
    }
    const current = snap.data() as CloseCapableCase;
    if (current.ownerUid !== uid) {
      throw new Error('FORBIDDEN');
    }
    assertNotExpired(current);
    tx.update(ref, { exportConsent: false, version: current.version + 1, updatedAt: new Date().toISOString() });
  });
}

/**
 * Revokes retention consent on an already-closed, `selected-7d` case: either
 * downgrades it to `facts-24h` (purging `evidence` and downgrading every
 * non-paid-payment fact to `source not retained`) or, at the user's choice,
 * deletes everything outright via `deleteCaseContent`. Rejects
 * `NOT_SELECTED_RETENTION` if called on a case that isn't currently
 * `selected-7d` - there is nothing to downgrade from.
 */
export async function revokeRetentionConsent(
  db: Firestore,
  uid: string,
  caseId: string,
  downgradeTo: 'facts-24h' | 'delete-on-close' = 'facts-24h',
): Promise<void> {
  if (downgradeTo === 'delete-on-close') {
    await deleteCaseContent(db, uid, caseId);
    return;
  }

  const ref = caseRef(db, caseId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error('FORBIDDEN');
  }
  const current = snap.data() as RetainedCaseProjection & { ownerUid: string };
  if (current.ownerUid !== uid) {
    throw new Error('FORBIDDEN');
  }
  assertNotExpired(current);
  if (current.retentionMode !== 'selected-7d') {
    throw new Error('NOT_SELECTED_RETENTION');
  }

  await deleteCollection(db, ref.collection('evidence'));

  const downgradedConfirmed: RetainedConfirmed = {};
  for (const [field, value] of Object.entries(current.confirmed ?? {})) {
    if ('reportedAt' in value) {
      downgradedConfirmed[field] = value;
      continue;
    }
    downgradedConfirmed[field] = { ...value, sourceRetained: false, sourceIds: [], provenanceLabel: 'source not retained' };
  }

  const now = new Date();
  const cappedExpiresAt = new Date(now.getTime() + FACTS_24H_MS).toISOString();
  const next: RetainedCaseProjection = {
    ...current,
    confirmed: downgradedConfirmed,
    retentionMode: 'facts-24h',
    // Revocation may only ever SHORTEN retention, never extend it.
    expiresAt: current.expiresAt !== undefined && current.expiresAt < cappedExpiresAt ? current.expiresAt : cappedExpiresAt,
    updatedAt: now.toISOString(),
  };
  // Transactional re-check so a concurrent writer (e.g. an export-consent
  // revocation) is not overwritten by this read-then-set.
  await db.runTransaction(async (tx) => {
    const latestSnap = await tx.get(ref);
    if (!latestSnap.exists) {
      throw new Error('FORBIDDEN');
    }
    const latest = latestSnap.data() as RetainedCaseProjection;
    if (latest.version !== current.version || latest.retentionMode !== 'selected-7d') {
      throw new Error('CONCURRENT_MODIFICATION');
    }
    tx.set(ref, { ...next, version: latest.version + 1 });
  });
}
