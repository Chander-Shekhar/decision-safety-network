import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { CaseCommandResult } from '@dsn/contracts';
import {
  REQUIRED_FACT_FIELDS,
  type CandidateFact,
  type Fact,
  type FactSegmentInput,
  type FactsProjection,
  type GeminiPort,
} from '../../../packages/contracts/src/facts.js';

const REQUIRED_FIELD_SET: ReadonlySet<string> = new Set(REQUIRED_FACT_FIELDS);

/**
 * Turns Gemini's already-schema-parsed candidates into displayed `Fact`s.
 * Trust rules (PRD C3/C12), enforced here rather than left to the model:
 *
 * - A candidate citing zero segments, or any segment id not in
 *   `knownSegmentIds`, is dropped outright - a fabricated or dangling
 *   citation can never enter trusted or even displayed state.
 * - A candidate for a field in `supersededFields` (the owner has already
 *   confirmed or corrected that field) is dropped - corrections/confirmations
 *   always take precedence over a later or in-flight model candidate.
 * - Every field in `REQUIRED_FACT_FIELDS` not otherwise superseded gets an
 *   entry: either the model's candidate, or an explicit `'unknown'`
 *   placeholder. The UI must never show a silent gap.
 *
 * Hostile text embedded in a transcript segment (prompt injection) is inert
 * here by construction: a candidate's `value` is only ever stored verbatim
 * as an opaque claimed string. Nothing in this function branches on, or is
 * ever influenced by, the *content* of `field`/`value` strings - only their
 * shape (citations, which field) affects the outcome.
 */
export function validateFacts(
  candidates: readonly CandidateFact[],
  knownSegmentIds: ReadonlySet<string>,
  supersededFields: ReadonlySet<string>,
): Fact[] {
  const byField = new Map<string, Fact>();

  for (const candidate of candidates) {
    if (supersededFields.has(candidate.field)) {
      continue;
    }
    if (!Array.isArray(candidate.sourceSegmentIds) || candidate.sourceSegmentIds.length === 0) {
      continue;
    }
    if (!candidate.sourceSegmentIds.every((id) => knownSegmentIds.has(id))) {
      continue;
    }
    if (typeof candidate.value !== 'string' || candidate.value.length === 0) {
      continue;
    }
    byField.set(candidate.field, {
      field: candidate.field,
      value: candidate.value,
      origin: 'model',
      sourceSegmentIds: [...candidate.sourceSegmentIds],
      uncertainty: candidate.uncertainty,
    });
  }

  for (const field of REQUIRED_FIELD_SET) {
    if (supersededFields.has(field) || byField.has(field)) {
      continue;
    }
    byField.set(field, { field, value: 'unknown', origin: 'model', sourceSegmentIds: [], uncertainty: 'high' });
  }

  return [...byField.values()];
}

/**
 * Bounded wait for one promise; rejects with `GEMINI_TIMEOUT` if it does not
 * settle in time. Accepted for the MVP: this races the call against a timer
 * rather than aborting it - a timed-out `gemini.extract` call keeps running
 * in the background (its eventual result is simply never awaited again).
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Calls `gemini.extract` with a bounded timeout and exactly one retry on
 * failure (timeout or thrown error). A second failure returns `'degraded'`
 * rather than throwing - live extraction being impaired must never block
 * manual controls (`correctFact`/`confirmFact` stay available).
 */
async function extractWithRetry(
  gemini: GeminiPort,
  segments: FactSegmentInput[],
  timeoutMs: number,
): Promise<CandidateFact[] | 'degraded'> {
  try {
    return await withTimeout(gemini.extract(segments), timeoutMs);
  } catch {
    try {
      return await withTimeout(gemini.extract(segments), timeoutMs);
    } catch {
      return 'degraded';
    }
  }
}

const DEFAULT_EXTRACT_TIMEOUT_MS = 8000;

export type ExtractOutcome = { status: 'ok'; projection: FactsProjection } | { status: 'degraded' };

export interface ExtractFactsOptions {
  timeoutMs?: number;
  modelVersion?: string;
}

/**
 * Authoritative owner/session check, read directly (no transaction) BEFORE
 * any transcript segment is read or `GeminiPort.extract` is called (decision
 * 0004, rule 1). A non-owner (or a nonexistent case) must trigger zero
 * segment reads and zero model calls - the case's `appendSegment`/model-call
 * path can be expensive and processes another owner's private transcript,
 * so it must never run for anyone but the owner. The commit transaction
 * inside `extractFacts` still re-checks owner, `sessionClosed`, and
 * `expectedVersion` authoritatively afterward (defense in depth / no TOCTOU
 * on the version token); this call is a cheap pre-check, not a replacement.
 */
export async function assertExtractionAuthorized(db: Firestore, uid: string, caseId: string): Promise<void> {
  const snap = await db.collection('cases').doc(caseId).get();
  if (!snap.exists) {
    throw new Error('FORBIDDEN');
  }
  const current = snap.data() as FactsProjection & { sessionClosed?: boolean };
  if (current.ownerUid !== uid) {
    throw new Error('FORBIDDEN');
  }
  if (current.sessionClosed) {
    throw new Error('CONSENT_REQUIRED');
  }
}

/** Field-wise equality for one `Fact`, used to detect an actual change in the `facts` map. */
function sameFact(a: Fact | undefined, b: Fact | undefined): boolean {
  if (!a || !b) {
    return a === b;
  }
  return (
    a.value === b.value &&
    a.origin === b.origin &&
    a.uncertainty === b.uncertainty &&
    a.modelVersion === b.modelVersion &&
    a.supersededBy === b.supersededBy &&
    a.sourceSegmentIds.length === b.sourceSegmentIds.length &&
    a.sourceSegmentIds.every((id, index) => id === b.sourceSegmentIds[index])
  );
}

/** True if two `facts` maps are identical field-for-field (decision 0004 rule 2: idempotent on no change). */
function factMapsEqual(a: Record<string, Fact>, b: Record<string, Fact>): boolean {
  const fields = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...fields].every((field) => sameFact(a[field], b[field]));
}

/** Stable hash identifying one logical extraction attempt (same case + expected version + segment set). */
function extractionRequestHash(expectedVersion: number, knownSegmentIds: ReadonlySet<string>): string {
  const sortedIds = [...knownSegmentIds].sort();
  return createHash('sha256').update(JSON.stringify({ kind: 'facts.extracted', expectedVersion, segmentIds: sortedIds })).digest('hex');
}

/**
 * Runs one fresh extraction pass over the given (already-persisted, ordered)
 * segments and, if the model responds in time, merges validated results into
 * the case's live `facts` map. `expectedVersion` is the case version read
 * when extraction was triggered: it is re-checked at commit time (after the
 * model call, which may be slow) so a result that lands after the case
 * version has moved - including after `revokeProcessing`/`endSession` set
 * `sessionClosed` - throws instead of silently overwriting newer state.
 * `facts` is never a trusted-state projection; only `confirmed`
 * (`correctFact`/`confirmFact`) is.
 *
 * Per decision 0004: the commit is idempotent (no `version` bump, no event,
 * when the merged `facts` map does not actually change) and, when it does
 * change, writes exactly one metadata-only `CaseEvent` (never raw transcript
 * text) keyed by a stable id for this logical attempt (`extract-{expectedVersion}`),
 * mirroring `commitCaseCommand`'s event-first replay check: a retry of the
 * same attempt after it already committed replays the stored receipt rather
 * than re-running the version/session checks.
 */
export async function extractFacts(
  db: Firestore,
  uid: string,
  caseId: string,
  segments: FactSegmentInput[],
  expectedVersion: number,
  gemini: GeminiPort,
  options: ExtractFactsOptions = {},
): Promise<ExtractOutcome> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_EXTRACT_TIMEOUT_MS;
  const result = await extractWithRetry(gemini, segments, timeoutMs);
  if (result === 'degraded') {
    return { status: 'degraded' };
  }

  const knownSegmentIds = new Set(segments.map((segment) => segment.id));
  const requestHash = extractionRequestHash(expectedVersion, knownSegmentIds);
  const eventId = `extract-${expectedVersion}`;

  return db.runTransaction(async (tx) => {
    const caseRef = db.collection('cases').doc(caseId);
    const eventRef = caseRef.collection('events').doc(eventId);

    const snap = await tx.get(caseRef);
    if (!snap.exists) {
      throw new Error('FORBIDDEN');
    }
    const current = snap.data() as FactsProjection & { sessionClosed?: boolean };
    if (current.ownerUid !== uid) {
      throw new Error('FORBIDDEN');
    }

    const eventSnap = await tx.get(eventRef);
    if (eventSnap.exists) {
      if (eventSnap.get('requestHash') !== requestHash) {
        throw new Error('STALE_EXTRACTION');
      }
      const receipt = eventSnap.get('result') as CaseCommandResult;
      return { status: 'ok' as const, projection: { ...current, version: receipt.version, phase: receipt.phase } };
    }

    if (current.sessionClosed) {
      throw new Error('CONSENT_REQUIRED');
    }
    if (current.version !== expectedVersion) {
      throw new Error('STALE_EXTRACTION');
    }

    const supersededFields = new Set(Object.keys(current.confirmed ?? {}));
    const validated = validateFacts(result, knownSegmentIds, supersededFields);
    const currentFacts = current.facts ?? {};
    const nextFacts: Record<string, Fact> = { ...currentFacts };
    for (const fact of validated) {
      nextFacts[fact.field] = options.modelVersion ? { ...fact, modelVersion: options.modelVersion } : fact;
    }

    if (factMapsEqual(currentFacts, nextFacts)) {
      return { status: 'ok' as const, projection: current };
    }

    const changedFields = Object.keys(nextFacts).filter((field) => !sameFact(currentFacts[field], nextFacts[field]));
    const citedSegmentIds = new Set<string>();
    for (const field of changedFields) {
      for (const id of nextFacts[field]!.sourceSegmentIds) {
        citedSegmentIds.add(id);
      }
    }

    const nextVersion = current.version + 1;
    const now = new Date().toISOString();
    tx.update(caseRef, { facts: nextFacts, version: nextVersion, updatedAt: now });
    tx.create(eventRef, {
      id: eventId,
      caseId,
      actorUid: uid,
      kind: 'facts.extracted',
      at: now,
      causationId: eventId,
      policyVersion: 'cup-core-1',
      refs: [...changedFields, ...citedSegmentIds],
      requestHash,
      result: { id: current.id, version: nextVersion, phase: current.phase },
    });

    return { status: 'ok' as const, projection: { ...current, facts: nextFacts, version: nextVersion, updatedAt: now } };
  });
}

function assertKnownField(field: string): void {
  if (!REQUIRED_FIELD_SET.has(field)) {
    throw new Error('UNKNOWN_FIELD');
  }
}

/**
 * Records the owner's correction for one field: a new, non-source-linked
 * `user-corrected` fact becomes the trusted value in `confirmed`, and any
 * existing `model`-origin fact for that field is marked `supersededBy` so
 * its provenance is preserved rather than overwritten. Per PRD C12,
 * corrections append a superseding (metadata-only) event. Accepted for the
 * MVP: unlike `extractFacts`, this does not check `sessionClosed` - the
 * owner's manual controls stay available even after processing is revoked.
 */
export async function correctFact(
  db: Firestore,
  uid: string,
  caseId: string,
  field: string,
  value: string,
  expectedVersion: number,
): Promise<void> {
  assertKnownField(field);
  if (value.length === 0) {
    throw new Error('INVALID_VALUE');
  }

  await db.runTransaction(async (tx) => {
    const caseRef = db.collection('cases').doc(caseId);
    const snap = await tx.get(caseRef);
    if (!snap.exists) {
      throw new Error('FORBIDDEN');
    }
    const current = snap.data() as FactsProjection;
    if (current.ownerUid !== uid) {
      throw new Error('FORBIDDEN');
    }
    if (current.version !== expectedVersion) {
      throw new Error('VERSION_CONFLICT');
    }

    const correctedFact: Fact = { field, value, origin: 'user-corrected', sourceSegmentIds: [], uncertainty: 'low' };
    const nextConfirmed = { ...(current.confirmed ?? {}), [field]: correctedFact };
    const existingModelFact = current.facts?.[field];
    const nextFacts = existingModelFact
      ? { ...current.facts, [field]: { ...existingModelFact, supersededBy: 'user-corrected' as const } }
      : current.facts;

    const nextVersion = current.version + 1;
    const now = new Date().toISOString();
    const eventRef = caseRef.collection('events').doc(randomUUID());
    tx.update(caseRef, { confirmed: nextConfirmed, facts: nextFacts ?? {}, version: nextVersion, updatedAt: now });
    tx.create(eventRef, {
      id: eventRef.id,
      caseId,
      actorUid: uid,
      kind: 'fact-corrected',
      at: now,
      causationId: eventRef.id,
      policyVersion: 'cup-core-1',
      refs: [field],
      result: { id: current.id, version: nextVersion, phase: current.phase },
    });
  });
}

/**
 * Records the owner's confirmation of the model's current value for one
 * field: the existing `model`-origin fact is copied into `confirmed` as
 * `user-confirmed` (same value/citations - confirming affirms what was said
 * or entered, never that the underlying claim is genuine) and marked
 * `supersededBy` in `facts`. Requires an actual source-linked model fact to
 * confirm; the synthesized `'unknown'` placeholder cannot be confirmed.
 * Accepted for the MVP: like `correctFact`, this does not check
 * `sessionClosed` - manual confirmation stays available after revocation.
 */
export async function confirmFact(db: Firestore, uid: string, caseId: string, field: string, expectedVersion: number): Promise<void> {
  assertKnownField(field);

  await db.runTransaction(async (tx) => {
    const caseRef = db.collection('cases').doc(caseId);
    const snap = await tx.get(caseRef);
    if (!snap.exists) {
      throw new Error('FORBIDDEN');
    }
    const current = snap.data() as FactsProjection;
    if (current.ownerUid !== uid) {
      throw new Error('FORBIDDEN');
    }
    if (current.version !== expectedVersion) {
      throw new Error('VERSION_CONFLICT');
    }

    const modelFact = current.facts?.[field];
    if (!modelFact || modelFact.sourceSegmentIds.length === 0) {
      throw new Error('NO_MODEL_FACT');
    }

    const confirmedFact: Fact = { ...modelFact, origin: 'user-confirmed', uncertainty: 'low' };
    const nextConfirmed = { ...(current.confirmed ?? {}), [field]: confirmedFact };
    const nextFacts = { ...current.facts, [field]: { ...modelFact, supersededBy: 'user-confirmed' as const } };

    const nextVersion = current.version + 1;
    const now = new Date().toISOString();
    const eventRef = caseRef.collection('events').doc(randomUUID());
    tx.update(caseRef, { confirmed: nextConfirmed, facts: nextFacts, version: nextVersion, updatedAt: now });
    tx.create(eventRef, {
      id: eventRef.id,
      caseId,
      actorUid: uid,
      kind: 'fact-confirmed',
      at: now,
      causationId: eventRef.id,
      policyVersion: 'cup-core-1',
      refs: [field],
      result: { id: current.id, version: nextVersion, phase: current.phase },
    });
  });
}
