import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
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

/** Bounded wait for one promise; rejects with `GEMINI_TIMEOUT` if it does not settle in time. */
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
 * Runs one fresh extraction pass over the given (already-persisted, ordered)
 * segments and, if the model responds in time, merges validated results into
 * the case's live `facts` map. `expectedVersion` is the case version read
 * when extraction was triggered: it is re-checked at commit time (after the
 * model call, which may be slow) so a result that lands after the case
 * version has moved - including after `revokeProcessing`/`endSession` set
 * `sessionClosed` - throws instead of silently overwriting newer state.
 * `facts` is never a trusted-state projection; only `confirmed`
 * (`correctFact`/`confirmFact`) is.
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

  return db.runTransaction(async (tx) => {
    const caseRef = db.collection('cases').doc(caseId);
    const snap = await tx.get(caseRef);
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
    if (current.version !== expectedVersion) {
      throw new Error('STALE_EXTRACTION');
    }

    const supersededFields = new Set(Object.keys(current.confirmed ?? {}));
    const validated = validateFacts(result, knownSegmentIds, supersededFields);
    const nextFacts: Record<string, Fact> = { ...(current.facts ?? {}) };
    for (const fact of validated) {
      nextFacts[fact.field] = options.modelVersion ? { ...fact, modelVersion: options.modelVersion } : fact;
    }

    const nextVersion = current.version + 1;
    const now = new Date().toISOString();
    tx.update(caseRef, { facts: nextFacts, version: nextVersion, updatedAt: now });

    return { status: 'ok', projection: { ...current, facts: nextFacts, version: nextVersion, updatedAt: now } };
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
 * corrections append a superseding (metadata-only) event.
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
