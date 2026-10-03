import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import type { CaseCommand, CaseCommandResult, CaseEnvelope, CaseReducer } from '@dsn/contracts';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';

const idempotencyKeySchema = z.uuid();

/** Deep-sorts object keys so hashing is independent of key insertion order. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entryValue]) => [key, canonical(entryValue)]),
    );
  }
  return value;
}

/** Stable hash of a command's kind+payload, used to detect idempotency-key reuse with a different payload. */
function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

/**
 * Creates a new case for `ownerUid` at `planVersion`. Requires an existing
 * owner plan document (Task 2 owns its schema; this module only checks
 * presence) so a case can never exist without an accepted plan.
 */
export async function createCase(
  db: Firestore,
  ownerUid: string,
  planVersion: number,
): Promise<CaseEnvelope> {
  const planSnap = await db.collection('plans').doc(ownerUid).get();
  if (!planSnap.exists) {
    throw new Error('PLAN_REQUIRED');
  }

  const caseRef = db.collection('cases').doc(randomUUID());
  const timestamp = new Date().toISOString();
  const envelope: CaseEnvelope = {
    id: caseRef.id,
    ownerUid,
    version: 0,
    phase: 'Observe',
    planVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await caseRef.create(envelope);
  return envelope;
}

/**
 * Reads a case projection, denying access to anyone but the owner. A
 * nonexistent case and a wrong-owner case both throw `FORBIDDEN` so a
 * probing request cannot distinguish "no such case" from "not yours".
 * Ownership is checked before expiry, so a non-owner still gets `FORBIDDEN`
 * (never learns the case expired) and an owner gets `EXPIRED` once
 * `expiresAt` has passed.
 */
export async function readCase<T extends CaseEnvelope = CaseEnvelope>(
  db: Firestore,
  requesterUid: string,
  caseId: string,
): Promise<T> {
  const snap = await db.collection('cases').doc(caseId).get();
  if (!snap.exists) {
    throw new Error('FORBIDDEN');
  }
  const data = snap.data() as T;
  if (data.ownerUid !== requesterUid) {
    throw new Error('FORBIDDEN');
  }
  if (data.expiresAt !== undefined && data.expiresAt <= new Date().toISOString()) {
    throw new Error('EXPIRED');
  }
  return data;
}

/**
 * Atomically applies one idempotent command to a case. Ownership is checked
 * BEFORE the idempotency receipt is read, so a non-owner can never learn
 * whether a given idempotency key was already used. The event document ID
 * is the idempotency key; only a `requestHash` (sha256 of kind+payload) is
 * stored, never the raw payload. Duplicate key + same payload replays the
 * original receipt; duplicate key + different payload is a conflict; a
 * stale `expectedVersion` is a conflict.
 */
export async function commitCaseCommand<T extends CaseEnvelope = CaseEnvelope>(
  db: Firestore,
  command: CaseCommand,
  reducer: CaseReducer<T>,
): Promise<CaseCommandResult> {
  if (!idempotencyKeySchema.safeParse(command.idempotencyKey).success) {
    throw new Error('INVALID_IDEMPOTENCY_KEY');
  }

  return db.runTransaction(async (tx) => {
    const caseRef = db.collection('cases').doc(command.caseId);
    const eventRef = caseRef.collection('events').doc(command.idempotencyKey);

    const caseSnap = await tx.get(caseRef);
    if (!caseSnap.exists) {
      throw new Error('FORBIDDEN');
    }
    const current = caseSnap.data() as T;
    if (current.ownerUid !== command.actorUid) {
      throw new Error('FORBIDDEN');
    }

    const requestHash = stableHash({ kind: command.kind, payload: command.payload });
    const eventSnap = await tx.get(eventRef);
    if (eventSnap.exists) {
      if (eventSnap.get('requestHash') !== requestHash) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      return eventSnap.get('result') as CaseCommandResult;
    }

    if (current.version !== command.expectedVersion) {
      throw new Error('VERSION_CONFLICT');
    }

    const reduced = reducer(current, command);
    const next: T = { ...reduced, version: current.version + 1, updatedAt: new Date().toISOString() };
    const receipt: CaseCommandResult = { id: next.id, version: next.version, phase: next.phase };

    tx.create(eventRef, {
      id: command.idempotencyKey,
      caseId: command.caseId,
      actorUid: command.actorUid,
      kind: command.kind,
      at: new Date().toISOString(),
      causationId: command.idempotencyKey,
      policyVersion: 'cup-core-1',
      refs: [],
      requestHash,
      result: receipt,
    });
    tx.update(caseRef, { ...next });

    return receipt;
  });
}

/** Foundation case routes: create and read one's own case. */
export const caseRoutes: RouteInstaller = (app, deps: ApiDeps) => {
  app.post('/api/v1/cases', async (request) => {
    const uid = await requireUser(request, deps.auth);
    const planSnap = await deps.db.collection('plans').doc(uid).get();
    if (!planSnap.exists) {
      throw new Error('PLAN_REQUIRED');
    }
    const planVersion = planSnap.get('version') as number;
    return createCase(deps.db, uid, planVersion);
  });

  app.get('/api/v1/cases/:id', async (request) => {
    const uid = await requireUser(request, deps.auth);
    const { id } = request.params as { id: string };
    return readCase(deps.db, uid, id);
  });
};
