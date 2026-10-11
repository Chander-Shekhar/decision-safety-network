import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createPlan, normalizePlan, PLAN_CONTRACT_VERSION } from '../../../packages/contracts/src/plan.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { getPlan, savePlan } from '../src/plan.js';
import { planRoutes } from '../src/plan-routes.js';
import { authHeader } from './test-auth.js';

let db: Firestore;
let deps: ApiDeps;

beforeAll(() => {
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-dsn' });
  }
  db = getFirestore();
  deps = { auth: getAuth(), db, now: () => new Date() };
});

const uid = () => `owner-${randomUUID()}`;
const BASE = {
  thresholdMinor: 500000,
  bankId: 'demo-bank' as const,
  processingConsent: true,
  retentionMode: 'facts-24h' as const,
  allySharingConsent: true,
  exportConsent: false,
};

describe('plan contract v2 (DSN-023)', () => {
  it('createPlan fills additive v2 defaults: per-call listening, no accounts, not configured', () => {
    const plan = createPlan({ thresholdMinor: 1, bankId: 'demo-bank' });
    expect(plan.contractVersion).toBe(PLAN_CONTRACT_VERSION);
    expect(plan.callListening).toBe('per-call');
    expect(plan.bankAccounts).toEqual([]);
    expect(plan.allyShareFields).not.toContain('selectedEvidence');
    expect(plan.setupCompletedAt).toBeUndefined();
  });

  it('normalizePlan upgrades a v1 document without losing v1 fields', () => {
    const v1 = {
      ownerUid: 'o',
      version: 3,
      thresholdMinor: 9,
      bankId: 'demo-bank' as const,
      processingConsent: true,
      retentionMode: 'selected-7d' as const,
      allySharingConsent: true,
      exportConsent: true,
    };
    expect(normalizePlan(v1)).toMatchObject({ ...v1, callListening: 'per-call', contractVersion: PLAN_CONTRACT_VERSION });
  });

  it('a v1-style save (no v2 fields) preserves stored v2 values', async () => {
    const o = uid();
    await savePlan(db, o, {
      ...BASE,
      callListening: 'all-calls',
      bankAccounts: [{ id: 'a1', label: 'Demo Savings', last4: '4821' }],
      completeSetup: true,
    });
    const resaved = await savePlan(db, o, { ...BASE, thresholdMinor: 700000 });
    expect(resaved.callListening).toBe('all-calls');
    expect(resaved.bankAccounts).toHaveLength(1);
    expect(resaved.setupCompletedAt).toBeTruthy();
  });

  it('getPlan reads a legacy v1 document normalized, and null when absent', async () => {
    const o = uid();
    expect(await getPlan(db, o)).toBeNull();
    await db.collection('plans').doc(o).set({ ownerUid: o, version: 1, ...BASE });
    expect((await getPlan(db, o))?.callListening).toBe('per-call');
  });
});

describe('first-run setup over HTTP', () => {
  it('fresh user: GET /plan is 404; PUT with completeSetup persists; GET then returns the configured plan', async () => {
    const o = uid();
    const app = buildApi([planRoutes], deps);
    const headers = await authHeader(o);
    expect((await app.inject({ method: 'GET', url: '/api/v1/plan', headers })).statusCode).toBe(404);

    const put = await app.inject({
      method: 'PUT',
      url: '/api/v1/plan',
      headers,
      payload: {
        ...BASE,
        callListening: 'unverified-only',
        allyShareFields: ['claim', 'amount'],
        bankAccounts: [{ id: 'a1', label: 'Demo Savings', last4: '4821' }],
        completeSetup: true,
      },
    });
    expect(put.statusCode).toBe(200);

    const got = await app.inject({ method: 'GET', url: '/api/v1/plan', headers });
    expect(got.statusCode).toBe(200);
    expect(got.json()).toMatchObject({
      callListening: 'unverified-only',
      allyShareFields: ['claim', 'amount'],
      contractVersion: PLAN_CONTRACT_VERSION,
    });
    expect((got.json() as { setupCompletedAt?: string }).setupCompletedAt).toBeTruthy();
  });

  it('rejects an invalid listening mode and a non-4-digit account suffix; GET requires auth', async () => {
    const app = buildApi([planRoutes], deps);
    const headers = await authHeader(uid());
    const bad = await app.inject({ method: 'PUT', url: '/api/v1/plan', headers, payload: { ...BASE, callListening: 'always' } });
    expect(bad.statusCode).toBe(400);
    const badAcct = await app.inject({
      method: 'PUT',
      url: '/api/v1/plan',
      headers,
      payload: { ...BASE, bankAccounts: [{ id: 'a', label: 'x', last4: '12345678' }] },
    });
    expect(badAcct.statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/v1/plan' })).statusCode).toBe(401);
  });
});
