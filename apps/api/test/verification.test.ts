import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase, readCase } from '../src/case-store.js';
import { savePlan } from '../src/plan.js';
import { appendSegment } from '../src/session.js';
import { correctFact } from '../src/fact-validator.js';
import { saveDraft, submitIntent, applyValidatedRelation } from '../src/payment.js';
import { act } from '../src/decision-routes.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { authHeader } from './test-auth.js';
import { verifyWithDemoBank, type VerificationProjection } from '../src/verification.js';
import { createVerificationRoutes } from '../src/verification-routes.js';
import { DEMO_BANK_REGISTRY } from '../src/demo-bank-registry.js';
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

/** Mirrors payment.test.ts/decision.test.ts's seedCase: a plan (always the registry's own bank id) plus a fresh, quiet Observe-phase case. */
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

async function readProjection(ownerUid: string, caseId: string): Promise<VerificationProjection> {
  return readCase<VerificationProjection>(db, ownerUid, caseId);
}

async function eventCount(caseId: string): Promise<number> {
  return (await db.collection('cases').doc(caseId).collection('events').get()).size;
}

/** Marks every declared field of a relation as a confirmed match - the "fully joined" shape, mirroring payment.test.ts/decision.test.ts's helper. */
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

/** Seeds a case with manipulation cues confirmed and an unverified claim, submitted without a joined relation - lands in `Check` (mirrors decision.test.ts's own Check-phase seed). */
async function seedCheckCase(ownerUid: string): Promise<{ caseId: string; projection: PaymentProjection }> {
  const caseId = await seedCase(ownerUid, 10_000);
  await appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'This is urgent, pay now.' }, () => {});
  const afterTactics = await readCase<PaymentProjection>(db, ownerUid, caseId);
  await correctFact(db, ownerUid, caseId, 'observedTactics', 'urgency-pressure', afterTactics.version);
  const afterCorrect = await readCase<PaymentProjection>(db, ownerUid, caseId);

  const draft = await saveDraft(db, ownerUid, caseId, {
    beneficiaryId: 'safe-new',
    amountMinor: 5_000,
    expectedVersion: afterCorrect.version,
    idempotencyKey: randomUUID(),
  });
  const pending = await submitIntent(db, ownerUid, caseId, {
    draftId: draft.paymentDraft!.id,
    expectedVersion: draft.version,
    idempotencyKey: randomUUID(),
  });
  return { caseId, projection: pending };
}

/** Seeds a case already joined into `Pause`: manipulation cues + unverified claim + a validated matching large new-payee relation (mirrors decision.test.ts's `seedJoinedCase`). */
async function seedJoinedCase(ownerUid: string): Promise<{ caseId: string; pending: PaymentProjection }> {
  const caseId = await seedCase(ownerUid, 10_000);
  await appendSegment(db, ownerUid, { id: 's1', caseId, order: 1, speaker: 'caller', text: 'This is urgent, pay now.' }, () => {});
  const afterTactics = await readCase<PaymentProjection>(db, ownerUid, caseId);
  await correctFact(db, ownerUid, caseId, 'observedTactics', 'urgency-pressure', afterTactics.version);
  const afterCorrect = await readCase<PaymentProjection>(db, ownerUid, caseId);

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

describe('verifyWithDemoBank (completed simulated verification)', () => {
  it('produces a provenance-bearing simulated result from the versioned registry and moves a Check-phase case to Verify', async () => {
    const ownerUid = uid('owner');
    const { caseId, projection } = await seedCheckCase(ownerUid);
    expect(projection.phase).toBe('Check');

    const result = await verifyWithDemoBank(db, caseId, ownerUid);

    expect(result.bankId).toBe('demo-bank');
    expect(result.registryVersion).toBe(DEMO_BANK_REGISTRY.version);
    expect(result.method).toBe('versioned-demo-registry');
    expect(result.simulated).toBe(true);
    expect(result.outboundFraudCall).toBe(false);
    expect(result.protectedTransferRequested).toBe(false);
    expect(typeof result.checkedAt).toBe('string');

    const persisted = await readProjection(ownerUid, caseId);
    expect(persisted.phase).toBe('Verify');
    expect(persisted.verification).toEqual(result);
  });

  it('verifies a joined Pause-phase case, moving phase to Verify while leaving paymentState and reasons untouched', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);
    expect(pending.phase).toBe('Pause');

    await verifyWithDemoBank(db, caseId, ownerUid);

    const persisted = await readCase<VerificationProjection & PaymentProjection>(db, ownerUid, caseId);
    expect(persisted.phase).toBe('Verify');
    expect(persisted.paymentState).toBe('pending');
    expect(persisted.reasons).toEqual(pending.reasons);
  });

  it('verifying a case already in Verify leaves phase at Verify (no self-transition) and still records the result', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);
    const alreadyVerify = await act(db, ownerUid, caseId, { kind: 'verify', key: randomUUID(), expectedVersion: pending.version });
    expect(alreadyVerify.phase).toBe('Verify');

    const result = await verifyWithDemoBank(db, caseId, ownerUid);
    expect(result.simulated).toBe(true);

    const persisted = await readProjection(ownerUid, caseId);
    expect(persisted.phase).toBe('Verify');
    expect(persisted.verification).toEqual(result);
  });

  it('rejects verifying a quiet Observe-phase case with ILLEGAL_TRANSITION (not yet in Check/Pause/Verify)', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const created = await readProjection(ownerUid, caseId);
    expect(created.phase).toBe('Observe');

    await expect(verifyWithDemoBank(db, caseId, ownerUid)).rejects.toThrow('ILLEGAL_TRANSITION');
  });

  it('is idempotent: a second call returns the identical stored result and writes no additional event', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedCheckCase(ownerUid);

    const first = await verifyWithDemoBank(db, caseId, ownerUid);
    const beforeEvents = await eventCount(caseId);
    const afterFirstVersion = (await readProjection(ownerUid, caseId)).version;

    const second = await verifyWithDemoBank(db, caseId, ownerUid);

    expect(second).toEqual(first);
    expect(await eventCount(caseId)).toBe(beforeEvents);
    expect((await readProjection(ownerUid, caseId)).version).toBe(afterFirstVersion);
  });

  it('rejects a non-owner with FORBIDDEN', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedCheckCase(ownerUid);
    const other = uid('other');

    await expect(verifyWithDemoBank(db, caseId, other)).rejects.toThrow('FORBIDDEN');
  });

  it('rejects when the owner has no saved plan with PLAN_REQUIRED', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedCheckCase(ownerUid);
    await db.collection('plans').doc(ownerUid).delete();

    await expect(verifyWithDemoBank(db, caseId, ownerUid)).rejects.toThrow('PLAN_REQUIRED');
  });

  it('rejects when the owner\'s saved plan does not name the registry\'s own bank id, with UNKNOWN_BANK', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedCheckCase(ownerUid);
    // Directly overwrites the raw Firestore doc (bypassing `savePlan`'s
    // `bankId: 'demo-bank'` literal type) to simulate a corrupted/foreign
    // plan record - `Plan.bankId` has no other legal value in this build,
    // so this is the only way to exercise the defense-in-depth guard.
    await db.collection('plans').doc(ownerUid).set({ bankId: 'some-other-bank' }, { merge: true });

    await expect(verifyWithDemoBank(db, caseId, ownerUid)).rejects.toThrow('UNKNOWN_BANK');
  });
});

describe('C9: resolved prevention outcome after Demo Bank verification', () => {
  it('after the simulated Demo Bank response rejects the claim, cancelling the simulated transfer durably records both outcomes and ends at phase Resolve', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending } = await seedJoinedCase(ownerUid);

    const result = await verifyWithDemoBank(db, caseId, ownerUid);
    expect(result.outboundFraudCall).toBe(false);
    expect(result.protectedTransferRequested).toBe(false);

    const afterVerify = await readProjection(ownerUid, caseId);
    void pending;

    const cancelled = await act(db, ownerUid, caseId, { kind: 'cancel', key: randomUUID(), expectedVersion: afterVerify.version });
    expect(cancelled.paymentState).toBe('cancelled');
    expect(cancelled.phase).toBe('Resolve');

    const final = await readCase<VerificationProjection & PaymentProjection>(db, ownerUid, caseId);
    expect(final.phase).toBe('Resolve');
    expect(final.paymentState).toBe('cancelled');
    expect(final.verification).toEqual(result);
    expect(final.verification?.simulated).toBe(true);
  });
});

describe('POST /api/v1/cases/:id/verify (authenticated route)', () => {
  it('rejects an unauthenticated request', async () => {
    const app = buildApi([createVerificationRoutes()], deps);
    const response = await app.inject({ method: 'POST', url: '/api/v1/cases/some-case/verify', payload: {} });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a caller-supplied contact field as a malformed request (400), never using it', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedCheckCase(ownerUid);

    const app = buildApi([createVerificationRoutes()], deps);
    const headers = await authHeader(ownerUid);
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/verify`,
      headers,
      payload: { callerSuggestedNumber: '9999999999' },
    });

    expect(response.statusCode).toBe(400);
    const persisted = await readProjection(ownerUid, caseId);
    expect(persisted.verification).toBeUndefined();
  });

  it('rejects a non-owner with FORBIDDEN', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedCheckCase(ownerUid);
    const other = uid('other');

    const app = buildApi([createVerificationRoutes()], deps);
    const headers = await authHeader(other);
    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/verify`, headers, payload: {} });
    expect(response.statusCode).toBe(403);
  });

  it('completes verification through the real authenticated route', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedCheckCase(ownerUid);

    const app = buildApi([createVerificationRoutes()], deps);
    const headers = await authHeader(ownerUid);
    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/verify`, headers, payload: {} });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { bankId: string; simulated: boolean; registryVersion: string };
    expect(body.bankId).toBe('demo-bank');
    expect(body.simulated).toBe(true);
    expect(body.registryVersion).toBe(DEMO_BANK_REGISTRY.version);

    const persisted = await readProjection(ownerUid, caseId);
    expect(persisted.phase).toBe('Verify');
  });

  it('maps UNKNOWN_BANK to 400 through the route', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedCheckCase(ownerUid);
    await db.collection('plans').doc(ownerUid).set({ bankId: 'some-other-bank' }, { merge: true });

    const app = buildApi([createVerificationRoutes()], deps);
    const headers = await authHeader(ownerUid);
    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/verify`, headers, payload: {} });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'UNKNOWN_BANK' });
  });

  it('maps ILLEGAL_TRANSITION to 409 through the route for a quiet Observe-phase case', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);

    const app = buildApi([createVerificationRoutes()], deps);
    const headers = await authHeader(ownerUid);
    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/verify`, headers, payload: {} });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'ILLEGAL_TRANSITION' });
  });
});

describe('GET /api/v1/registry/demo-bank (authenticated route)', () => {
  it('rejects an unauthenticated request', async () => {
    const app = buildApi([createVerificationRoutes()], deps);
    const response = await app.inject({ method: 'GET', url: '/api/v1/registry/demo-bank' });
    expect(response.statusCode).toBe(401);
  });

  it('returns the versioned fictional registry record, never a real-bank claim', async () => {
    const app = buildApi([createVerificationRoutes()], deps);
    const headers = await authHeader(uid('owner'));
    const response = await app.inject({ method: 'GET', url: '/api/v1/registry/demo-bank', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(DEMO_BANK_REGISTRY);
    expect(response.json().fictional).toBe(true);
  });
});
