import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase, readCase } from '../src/case-store.js';
import { savePlan } from '../src/plan.js';
import { appendSegment } from '../src/session.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { authHeader } from './test-auth.js';
import { saveDraft, submitIntent, applyValidatedRelation } from '../src/payment.js';
import { act, createDecisionRoutes } from '../src/decision-routes.js';
import type { CandidateRelation } from '../../../packages/contracts/src/facts.js';
import type { PaymentProjection } from '../../../packages/contracts/src/payment.js';

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

/** Mirrors payment.test.ts's seedCase: a plan plus a fresh case for it. */
async function seedCase(ownerUid: string, thresholdMinor = 500_000): Promise<string> {
  await savePlan(db, ownerUid, {
    thresholdMinor,
    bankId: 'demo-bank',
    processingConsent: true,
    retentionMode: 'facts-24h',
    allySharingConsent: true,
    exportConsent: true,
  });
  const created = await createCase(db, ownerUid, 1);
  return created.id;
}

async function readProjection(ownerUid: string, caseId: string): Promise<PaymentProjection> {
  return readCase<PaymentProjection>(db, ownerUid, caseId);
}

async function eventCount(caseId: string): Promise<number> {
  return (await db.collection('cases').doc(caseId).collection('events').get()).size;
}

/** Marks every declared field of a relation as a confirmed match - the "fully joined" shape, mirroring payment.test.ts's helper. */
function joinedRelation(partial: Omit<CandidateRelation, 'matches' | 'directedAction'>): CandidateRelation {
  return {
    ...partial,
    directedAction: true,
    matches: [
      { field: 'amountMinor', matches: true, sourceSegmentIds: partial.segmentIds },
      { field: 'beneficiaryId', matches: true, sourceSegmentIds: partial.segmentIds },
    ],
  };
}

/** Seeds a case already joined into Pause: manipulation cues + unverified claim + a validated matching large new-payee relation, per the PRD causal matrix. */
async function seedJoinedCase(ownerUid: string): Promise<{ caseId: string; pending: PaymentProjection }> {
  const caseId = await seedCase(ownerUid, 10_000);
  await appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'This is urgent, pay now.' }, () => {});
  const afterTactics = await readProjection(ownerUid, caseId);
  const { correctFact } = await import('../src/fact-validator.js');
  await correctFact(db, ownerUid, caseId, 'observedTactics', 'urgency-pressure', afterTactics.version);
  const afterCorrect = await readProjection(ownerUid, caseId);

  const draft = await saveDraft(db, ownerUid, caseId, {
    beneficiaryId: 'safe-new',
    amountMinor: 50_000,
    expectedVersion: afterCorrect.version,
    idempotencyKey: randomUUID(),
  });
  const pendingBefore = await submitIntent(db, ownerUid, caseId, {
    draftId: draft.paymentDraft!.id,
    expectedVersion: draft.version,
    idempotencyKey: randomUUID(),
  });

  const relation = joinedRelation({
    segmentIds: ['s1'],
    draftEventId: draft.paymentDraft!.id,
    draftVersion: draft.paymentDraft!.version,
    inputCaseVersion: pendingBefore.version,
  });
  const pending = await applyValidatedRelation(db, caseId, relation);
  return { caseId, pending };
}

describe('act (explicit human decision commands)', () => {
  it('pause sets paymentState to paused without changing phase', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);
    expect(pending.phase).toBe('Pause');

    const result = await act(db, ownerUid, caseId, { kind: 'pause', key: randomUUID(), expectedVersion: pending.version });
    expect(result.paymentState).toBe('paused');
    expect(result.phase).toBe('Pause');
  });

  it('cancel sets paymentState to cancelled and resolves the case', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);

    const result = await act(db, ownerUid, caseId, { kind: 'cancel', key: randomUUID(), expectedVersion: pending.version });
    expect(result.paymentState).toBe('cancelled');
    expect(result.phase).toBe('Resolve');

    const persisted = await readProjection(ownerUid, caseId);
    expect(persisted.phase).toBe('Resolve');
    expect(persisted.paymentState).toBe('cancelled');
  });

  it('verify from a joined Pause case moves phase to Verify without touching paymentState, as a single event (version +1)', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);
    const beforeEvents = await eventCount(caseId);

    const result = await act(db, ownerUid, caseId, { kind: 'verify', key: randomUUID(), expectedVersion: pending.version });
    expect(result.phase).toBe('Verify');
    expect(result.paymentState).toBe('pending');
    expect(result.version).toBe(pending.version + 1);
    expect(await eventCount(caseId)).toBe(beforeEvents + 1);
  });

  it('verify from a Check-phase case (cues present, not yet joined) stays a single event (version +1)', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid, 10_000);
    await appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'This is urgent, pay now.' }, () => {});
    const afterTactics = await readProjection(ownerUid, caseId);
    const { correctFact } = await import('../src/fact-validator.js');
    await correctFact(db, ownerUid, caseId, 'observedTactics', 'urgency-pressure', afterTactics.version);
    const afterCorrect = await readProjection(ownerUid, caseId);

    const draft = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'safe-new',
      amountMinor: 50_000,
      expectedVersion: afterCorrect.version,
      idempotencyKey: randomUUID(),
    });
    const pendingBefore = await submitIntent(db, ownerUid, caseId, {
      draftId: draft.paymentDraft!.id,
      expectedVersion: draft.version,
      idempotencyKey: randomUUID(),
    });
    expect(pendingBefore.phase).toBe('Check');

    const beforeEvents = await eventCount(caseId);
    const result = await act(db, ownerUid, caseId, { kind: 'verify', key: randomUUID(), expectedVersion: pendingBefore.version });

    expect(result.phase).toBe('Verify');
    expect(result.version).toBe(pendingBefore.version + 1);
    expect(await eventCount(caseId)).toBe(beforeEvents + 1);
  });

  it('verify from a quiet Observe-only case persists TWO individually legal events (Observe->Check, then Check->Verify), never a single collapsed Observe->Verify event', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const created = await readProjection(ownerUid, caseId);
    expect(created.phase).toBe('Observe');
    const beforeEvents = await eventCount(caseId);

    const result = await act(db, ownerUid, caseId, { kind: 'verify', key: randomUUID(), expectedVersion: created.version });
    expect(result.phase).toBe('Verify');
    expect(result.version).toBe(created.version + 2);

    const eventsSnap = await db.collection('cases').doc(caseId).collection('events').get();
    expect(eventsSnap.size).toBe(beforeEvents + 2);
    const results = eventsSnap.docs.map((d) => {
      const r = d.get('result') as { version: number; phase: string };
      return { version: r.version, phase: r.phase };
    });

    // The bug this fix removes committed a SINGLE event whose result was
    // phase Verify at version created.version + 1 - i.e. an Observe->Verify
    // jump the canonical transition table forbids. That must never appear.
    expect(results.some((r) => r.phase === 'Verify' && r.version === created.version + 1)).toBe(false);

    // Instead, two individually legal hops are each separately persisted.
    expect(results).toContainEqual({ version: created.version + 1, phase: 'Check' });
    expect(results).toContainEqual({ version: created.version + 2, phase: 'Verify' });
  });

  it('replaying the same two-hop verify key is idempotent: no extra events, no extra version bump, same final projection', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const created = await readProjection(ownerUid, caseId);
    const key = randomUUID();

    const first = await act(db, ownerUid, caseId, { kind: 'verify', key, expectedVersion: created.version });
    expect(first.phase).toBe('Verify');
    expect(first.version).toBe(created.version + 2);
    const afterFirstEvents = await eventCount(caseId);

    // Replays with the SAME (now-stale) original expectedVersion, mirroring
    // a client that retried after not receiving a response the first time.
    const second = await act(db, ownerUid, caseId, { kind: 'verify', key, expectedVersion: created.version });

    expect(second.version).toBe(first.version);
    expect(second.phase).toBe('Verify');
    expect(await eventCount(caseId)).toBe(afterFirstEvents);
  });

  it('continue without acknowledged=true is denied with ACK_REQUIRED and leaves the case untouched', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);
    const beforeEvents = await eventCount(caseId);

    await expect(
      act(db, ownerUid, caseId, { kind: 'continue', acknowledged: false, key: randomUUID(), expectedVersion: pending.version }),
    ).rejects.toThrow('ACK_REQUIRED');

    const after = await readProjection(ownerUid, caseId);
    expect(after.version).toBe(pending.version);
    expect(after.paymentState).not.toBe('continued');
    expect(await eventCount(caseId)).toBe(beforeEvents);
  });

  it('continue with acknowledged=true sets paymentState to continued and resolves the case', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);

    const result = await act(db, ownerUid, caseId, { kind: 'continue', acknowledged: true, key: randomUUID(), expectedVersion: pending.version });
    expect(result.paymentState).toBe('continued');
    expect(result.phase).toBe('Resolve');
  });

  it('never recomputes reasons: a joined case\'s reasons survive a pause action unchanged (act never calls assessCase)', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);
    expect(pending.reasons.length).toBeGreaterThan(0);

    const result = await act(db, ownerUid, caseId, { kind: 'pause', key: randomUUID(), expectedVersion: pending.version });
    expect(result.reasons).toEqual(pending.reasons);
  });

  it('replaying the same idempotency key returns the identical receipt: no duplicate event, no extra version bump', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);
    const key = randomUUID();
    const beforeEvents = await eventCount(caseId);

    const first = await act(db, ownerUid, caseId, { kind: 'pause', key, expectedVersion: pending.version });
    const second = await act(db, ownerUid, caseId, { kind: 'pause', key, expectedVersion: pending.version });

    expect(second.version).toBe(first.version);
    // Exactly one new event from the two act() calls above (the replay adds
    // none) - not an absolute count, since seedJoinedCase's own
    // segment/correction/draft/submit/relation steps already wrote events.
    expect(await eventCount(caseId)).toBe(beforeEvents + 1);
  });

  it('rejects further action once the payment is finalized (cancelled)', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);
    const cancelled = await act(db, ownerUid, caseId, { kind: 'cancel', key: randomUUID(), expectedVersion: pending.version });

    await expect(
      act(db, ownerUid, caseId, { kind: 'pause', key: randomUUID(), expectedVersion: cancelled.version }),
    ).rejects.toThrow('PAYMENT_FINALIZED');
  });

  it('rejects a non-owner with FORBIDDEN', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);
    const other = uid('other');

    await expect(
      act(db, other, caseId, { kind: 'pause', key: randomUUID(), expectedVersion: pending.version }),
    ).rejects.toThrow('FORBIDDEN');
  });
});

describe('POST /api/v1/cases/:id/actions/* (authenticated routes)', () => {
  it('rejects an unauthenticated request', async () => {
    const app = buildApi([createDecisionRoutes()], deps);
    const response = await app.inject({ method: 'POST', url: '/api/v1/cases/some-case/actions/pause', payload: {} });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a non-owner with FORBIDDEN', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);
    const other = uid('other');

    const app = buildApi([createDecisionRoutes()], deps);
    const headers = await authHeader(other);
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/actions/pause`,
      headers,
      payload: { expectedVersion: pending.version, idempotencyKey: randomUUID() },
    });
    expect(response.statusCode).toBe(403);
  });

  it('pauses the simulated transfer through the real authenticated route', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);

    const app = buildApi([createDecisionRoutes()], deps);
    const headers = await authHeader(ownerUid);
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/actions/pause`,
      headers,
      payload: { expectedVersion: pending.version, idempotencyKey: randomUUID() },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as PaymentProjection;
    expect(body.paymentState).toBe('paused');
  });

  it('rejects a continue body missing acknowledged as a malformed request', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);

    const app = buildApi([createDecisionRoutes()], deps);
    const headers = await authHeader(ownerUid);
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/actions/continue`,
      headers,
      payload: { expectedVersion: pending.version, idempotencyKey: randomUUID() },
    });
    expect(response.statusCode).toBe(400);
  });

  it('maps a present-but-false acknowledged to ACK_REQUIRED (400)', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);

    const app = buildApi([createDecisionRoutes()], deps);
    const headers = await authHeader(ownerUid);
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/actions/continue`,
      headers,
      payload: { expectedVersion: pending.version, idempotencyKey: randomUUID(), acknowledged: false },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'ACK_REQUIRED' });
  });

  it('confirms continue with acknowledged=true through the real authenticated route', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);

    const app = buildApi([createDecisionRoutes()], deps);
    const headers = await authHeader(ownerUid);
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/actions/continue`,
      headers,
      payload: { expectedVersion: pending.version, idempotencyKey: randomUUID(), acknowledged: true },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as PaymentProjection;
    expect(body.paymentState).toBe('continued');
    expect(body.phase).toBe('Resolve');
  });

  it('verify officially through the real authenticated route moves phase to Verify', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);

    const app = buildApi([createDecisionRoutes()], deps);
    const headers = await authHeader(ownerUid);
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/actions/verify`,
      headers,
      payload: { expectedVersion: pending.version, idempotencyKey: randomUUID() },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as PaymentProjection).phase).toBe('Verify');
  });

  it('a second cancel after the case is already resolved maps ILLEGAL_TRANSITION to 409', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);
    const cancelled = await act(db, ownerUid, caseId, { kind: 'cancel', key: randomUUID(), expectedVersion: pending.version });
    void cancelled;

    // Force the case back to a non-finalized paymentState so the second
    // cancel reaches the transition() call rather than being short-circuited
    // by the PAYMENT_FINALIZED guard - isolating the ILLEGAL_TRANSITION path.
    await db.collection('cases').doc(caseId).update({ paymentState: 'pending' });
    const resolvedButReopened = await readProjection(ownerUid, caseId);
    expect(resolvedButReopened.phase).toBe('Resolve');

    const app = buildApi([createDecisionRoutes()], deps);
    const headers = await authHeader(ownerUid);
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/actions/cancel`,
      headers,
      payload: { expectedVersion: resolvedButReopened.version, idempotencyKey: randomUUID() },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'ILLEGAL_TRANSITION' });
  });
});
