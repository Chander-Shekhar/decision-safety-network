import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase, readCase } from '../src/case-store.js';
import { savePlan } from '../src/plan.js';
import { appendSegment, endSession, revokeProcessing, type OnSegmentCallback } from '../src/session.js';
import { sessionRoutes } from '../src/session-routes.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { authHeader } from './test-auth.js';
import type { SessionProjection } from '../../../packages/contracts/src/session.js';

let db: Firestore;
let deps: ApiDeps;

beforeAll(() => {
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-dsn' });
  }
  db = getFirestore();
  deps = { auth: getAuth(), db, now: () => new Date() };
});

function uid(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

/** Saves a plan (processingConsent defaults to true) and creates a fresh case for it, returning the case id. */
async function seedCase(ownerUid: string, processingConsent = true): Promise<string> {
  await savePlan(db, ownerUid, {
    thresholdMinor: 500_000,
    bankId: 'demo-bank',
    processingConsent,
    retentionMode: 'facts-24h',
    allySharingConsent: true,
    exportConsent: true,
  });
  const created = await createCase(db, ownerUid, 1);
  return created.id;
}

/** A no-mocking-library callback recorder: avoids pulling in `vi.fn()` for a single counted callback. */
function recordingCallback(): { onSegment: OnSegmentCallback; calls: Array<{ caseId: string; version: number }> } {
  const calls: Array<{ caseId: string; version: number }> = [];
  return { onSegment: (caseId, version) => calls.push({ caseId, version }), calls };
}

describe('appendSegment', () => {
  it('accepts ordered segments incrementally, one event/version advance each', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const { onSegment, calls } = recordingCallback();

    const first = await appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'Transfer now' }, onSegment);
    expect(first).toEqual({ acceptedOrder: 1, caseVersion: 1 });
    const second = await appendSegment(db, ownerUid, { id: 's2', caseId, order: 2, speaker: 'caller', text: 'OTP' }, onSegment);
    expect(second).toEqual({ acceptedOrder: 2, caseVersion: 2 });

    expect(calls).toEqual([
      { caseId, version: 1 },
      { caseId, version: 2 },
    ]);
    const projection = await readCase<SessionProjection>(db, ownerUid, caseId);
    expect(projection.lastSegmentOrder).toBe(2);
    expect(projection.version).toBe(2);
  });

  it('rejects a gap/out-of-order segment with ORDER_CONFLICT and does not advance state', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const { onSegment, calls } = recordingCallback();

    await appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'Transfer now' }, onSegment);
    await expect(
      appendSegment(db, ownerUid, { id: 's3', caseId, order: 3, speaker: 'caller', text: 'OTP' }, onSegment),
    ).rejects.toThrow('ORDER_CONFLICT');

    expect(calls).toHaveLength(1);
    const projection = await readCase<SessionProjection>(db, ownerUid, caseId);
    expect(projection.lastSegmentOrder).toBe(1);
    expect(projection.version).toBe(1);
  });

  it('is idempotent for an exact duplicate append: no new event, callback not re-invoked', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const { onSegment, calls } = recordingCallback();
    const segment = { id: 's1', caseId, order: 1, speaker: 'caller', text: 'Transfer now' };

    const first = await appendSegment(db, ownerUid, segment, onSegment);
    const replay = await appendSegment(db, ownerUid, segment, onSegment);

    expect(replay).toEqual(first);
    expect(calls).toHaveLength(1);
    const events = await db.collection('cases').doc(caseId).collection('events').get();
    expect(events.docs).toHaveLength(1);
    const projection = await readCase<SessionProjection>(db, ownerUid, caseId);
    expect(projection.version).toBe(1);
  });

  it('rejects a reused segment id carrying different content as ORDER_CONFLICT', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const { onSegment } = recordingCallback();

    await appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'Transfer now' }, onSegment);
    await expect(
      appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'A completely different sentence' }, onSegment),
    ).rejects.toThrow('ORDER_CONFLICT');
  });

  it('rejects append from a non-owner with FORBIDDEN', async () => {
    const ownerUid = uid('owner');
    const impostorUid = uid('impostor');
    const caseId = await seedCase(ownerUid);
    const { onSegment } = recordingCallback();

    await expect(
      appendSegment(db, impostorUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'Transfer now' }, onSegment),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('rejects append when the owner has not granted processing consent, with CONSENT_REQUIRED', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid, false);
    const { onSegment, calls } = recordingCallback();

    await expect(
      appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'Transfer now' }, onSegment),
    ).rejects.toThrow('CONSENT_REQUIRED');
    expect(calls).toHaveLength(0);
  });

  it('revoking processing stops further intake; onSegment is called only for the one accepted segment', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const { onSegment, calls } = recordingCallback();

    await appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'Transfer now' }, onSegment);
    await expect(
      appendSegment(db, ownerUid, { id: 's3', caseId, order: 3, speaker: 'caller', text: 'OTP' }, onSegment),
    ).rejects.toThrow('ORDER_CONFLICT');
    await revokeProcessing(db, ownerUid, caseId);
    await expect(
      appendSegment(db, ownerUid, { id: 's2', caseId, order: 2, speaker: 'caller', text: 'More' }, onSegment),
    ).rejects.toThrow('CONSENT_REQUIRED');

    expect(calls).toHaveLength(1);
  });

  it('never writes raw transcript text into the committed event document', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const { onSegment } = recordingCallback();
    const sentinel = 'SENTINEL-do-not-leak-c9f1b2';

    await appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: sentinel }, onSegment);
    await appendSegment(db, ownerUid, { id: 's2', caseId, order: 2, speaker: 'caller', text: `more ${sentinel} text` }, onSegment);

    const events = await db.collection('cases').doc(caseId).collection('events').get();
    expect(events.docs).toHaveLength(2);
    for (const doc of events.docs) {
      const payload = JSON.stringify(doc.data());
      expect(payload).not.toContain(sentinel);
      expect(doc.data()).not.toHaveProperty('text');
    }
  });
});

describe('revokeProcessing', () => {
  it('stops intake without purging already-accepted raw segments', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const { onSegment } = recordingCallback();
    await appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'Transfer now' }, onSegment);

    await revokeProcessing(db, ownerUid, caseId);

    const segments = await db.collection('cases').doc(caseId).collection('segments').get();
    expect(segments.docs).toHaveLength(1);
    const projection = await readCase<SessionProjection>(db, ownerUid, caseId);
    expect(projection.sessionClosed).toBe(true);
  });

  it('is idempotent: calling it twice does not bump version again', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);

    await revokeProcessing(db, ownerUid, caseId);
    const afterFirst = await readCase<SessionProjection>(db, ownerUid, caseId);
    await revokeProcessing(db, ownerUid, caseId);
    const afterSecond = await readCase<SessionProjection>(db, ownerUid, caseId);

    expect(afterSecond.version).toBe(afterFirst.version);
  });

  it('rejects revoke from a non-owner with FORBIDDEN', async () => {
    const ownerUid = uid('owner');
    const impostorUid = uid('impostor');
    const caseId = await seedCase(ownerUid);

    await expect(revokeProcessing(db, impostorUid, caseId)).rejects.toThrow('FORBIDDEN');
  });
});

describe('endSession (internal, no public route)', () => {
  it('purges every accepted raw segment and stops further intake', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const { onSegment } = recordingCallback();
    await appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'Transfer now' }, onSegment);
    await appendSegment(db, ownerUid, { id: 's2', caseId, order: 2, speaker: 'caller', text: 'OTP' }, onSegment);

    await endSession(db, ownerUid, caseId);

    const segments = await db.collection('cases').doc(caseId).collection('segments').get();
    expect(segments.empty).toBe(true);
    const projection = await readCase<SessionProjection>(db, ownerUid, caseId);
    expect(projection.sessionClosed).toBe(true);
    await expect(
      appendSegment(db, ownerUid, { id: 's3', caseId, order: 3, speaker: 'caller', text: 'More' }, onSegment),
    ).rejects.toThrow('CONSENT_REQUIRED');
  });

  it('is idempotent: calling it twice does not error or re-bump version', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);

    await endSession(db, ownerUid, caseId);
    const afterFirst = await readCase<SessionProjection>(db, ownerUid, caseId);
    await endSession(db, ownerUid, caseId);
    const afterSecond = await readCase<SessionProjection>(db, ownerUid, caseId);

    expect(afterSecond.version).toBe(afterFirst.version);
  });

  it('rejects endSession from a non-owner with FORBIDDEN', async () => {
    const ownerUid = uid('owner');
    const impostorUid = uid('impostor');
    const caseId = await seedCase(ownerUid);

    await expect(endSession(db, impostorUid, caseId)).rejects.toThrow('FORBIDDEN');
  });
});

describe('authenticated session HTTP routes', () => {
  it('POST /api/v1/cases/:id/segments accepts an ordered segment and returns the receipt', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const app = buildApi([sessionRoutes], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/segments`,
      headers: await authHeader(ownerUid),
      payload: { id: 's1', order: 1, speaker: 'caller', text: 'Transfer now' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ acceptedOrder: 1, caseVersion: 1 });
  });

  it('POST /api/v1/cases/:id/segments denies an unauthenticated request', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const app = buildApi([sessionRoutes], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/segments`,
      payload: { id: 's1', order: 1, speaker: 'caller', text: 'Transfer now' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /api/v1/cases/:id/segments denies another user appending to someone else\'s case', async () => {
    const ownerUid = uid('owner');
    const impostorUid = uid('impostor');
    const caseId = await seedCase(ownerUid);
    const app = buildApi([sessionRoutes], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/segments`,
      headers: await authHeader(impostorUid),
      payload: { id: 's1', order: 1, speaker: 'caller', text: 'Transfer now' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('POST /api/v1/cases/:id/segments returns 409 for a gap/out-of-order segment', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const app = buildApi([sessionRoutes], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/segments`,
      headers: await authHeader(ownerUid),
      payload: { id: 's2', order: 2, speaker: 'caller', text: 'OTP' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('POST /api/v1/cases/:id/segments rejects an invalid body with 400', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const app = buildApi([sessionRoutes], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/segments`,
      headers: await authHeader(ownerUid),
      payload: { id: 's1', order: 0, speaker: 'caller', text: 'Transfer now' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /api/v1/cases/:id/processing/revoke stops further HTTP intake with 403 CONSENT_REQUIRED', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const app = buildApi([sessionRoutes], deps);

    const revokeResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/processing/revoke`,
      headers: await authHeader(ownerUid),
    });
    expect(revokeResponse.statusCode).toBe(204);

    const appendResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/segments`,
      headers: await authHeader(ownerUid),
      payload: { id: 's1', order: 1, speaker: 'caller', text: 'Transfer now' },
    });
    expect(appendResponse.statusCode).toBe(403);
  });

  it('POST /api/v1/cases/:id/processing/revoke denies an unauthenticated request', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const app = buildApi([sessionRoutes], deps);

    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/processing/revoke` });
    expect(response.statusCode).toBe(401);
  });

  it('POST /api/v1/cases/:id/processing/revoke denies another user revoking someone else\'s session', async () => {
    const ownerUid = uid('owner');
    const impostorUid = uid('impostor');
    const caseId = await seedCase(ownerUid);
    const app = buildApi([sessionRoutes], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/processing/revoke`,
      headers: await authHeader(impostorUid),
    });
    expect(response.statusCode).toBe(403);
  });
});
