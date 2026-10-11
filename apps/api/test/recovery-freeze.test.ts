import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase, readCase } from '../src/case-store.js';
import { savePlan } from '../src/plan.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { authHeader } from './test-auth.js';
import { confirmPaidDetails, enterRecovery } from '../src/recovery.js';
import { createRecoveryRoutes } from '../src/recovery-routes.js';
import type { RecoveryProjection } from '../../../packages/contracts/src/recovery.js';

let db: Firestore;
let deps: ApiDeps;

beforeAll(() => {
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-dsn' });
  }
  db = getFirestore();
  deps = { auth: getAuth(), db, now: () => new Date() };
});

const uid = (prefix: string): string => `${prefix}-${randomUUID()}`;

function confirmedFact(field: string, value: string) {
  return { field, value, origin: 'user-confirmed', sourceSegmentIds: ['s1'], uncertainty: 'low' };
}

async function seedCase(ownerUid: string, claimedIdentity = 'Bank fraud desk'): Promise<string> {
  await savePlan(db, ownerUid, {
    thresholdMinor: 500_000,
    bankId: 'demo-bank',
    processingConsent: true,
    retentionMode: 'facts-24h',
    allySharingConsent: true,
    exportConsent: true,
  });
  const { id } = await createCase(db, ownerUid, 1);
  await db.collection('cases').doc(id).update({
    phase: 'Pause',
    confirmed: {
      claimedIdentity: confirmedFact('claimedIdentity', claimedIdentity),
      centralClaim: confirmedFact('centralClaim', 'Account compromised'),
    },
    paymentDraft: { id: randomUUID(), beneficiaryId: 'safe-new', amountMinor: 5_000_000, newPayee: true, version: 1 },
    paymentState: 'pending',
  });
  return id;
}

describe('guided freeze (DSN-027) - guidance only, never a real freeze', () => {
  it('returns an affected-account-only card with a curated helpline and a case-filled script; claims no real freeze', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    const state = await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    const freeze = state.guidedFreeze!;
    expect(freeze).toMatchObject({ guided: true, realFreeze: false, scope: 'affected-account-only' });
    expect(freeze.helpline).toMatchObject({ institution: 'Demo Bank', source: 'demo-bank-registry', registryVersion: 'cup-1', simulated: true });
    expect(freeze.script).toContain('Rs 50,000');
    expect(freeze.script).toContain('safe-new');
    expect(freeze.script).toContain('Account compromised');
    // No-real-freeze assertion: no claim that anything was frozen, and no freeze state is written.
    expect(freeze.script).not.toMatch(/has been frozen|is frozen|was frozen|i froze/i);
    const after = await readCase<RecoveryProjection>(db, u, c);
    expect(after.phase).toBe('Recover');
    expect(after).not.toHaveProperty('frozen');
    expect(after).not.toHaveProperty('accountFrozen');
  });

  it('uses owner-reported paid details once recorded and never takes a phone number from case facts', async () => {
    const u = uid('owner');
    const c = await seedCase(u, 'Call me back on +91 99999 11111');
    await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    const state = await confirmPaidDetails(db, u, c, {
      kind: 'edit-paid-details',
      paidPayee: 'Acme Scam Ltd',
      paidAmountMinor: 123_450,
      referenceId: 'REF123',
      key: randomUUID(),
    });
    const freeze = state.guidedFreeze!;
    expect(freeze.script).toContain('Rs 1,234.5');
    expect(freeze.script).toContain('Acme Scam Ltd');
    expect(freeze.script).toContain('REF123');
    expect(freeze.script).not.toContain('99999');
    expect(freeze.helpline.number).toBe('1800 000 0000');
  });

  it('is served by the recovery route with only the curated helpline', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    const app = buildApi([createRecoveryRoutes()], deps);
    await app.inject({ method: 'POST', url: `/api/v1/cases/${c}/recovery/enter`, headers: await authHeader(u), payload: { idempotencyKey: randomUUID() } });
    const res = await app.inject({ method: 'GET', url: `/api/v1/cases/${c}/recovery`, headers: await authHeader(u) });
    expect(res.statusCode).toBe(200);
    expect(res.json().guidedFreeze).toMatchObject({ realFreeze: false, helpline: { number: '1800 000 0000', source: 'demo-bank-registry' } });
    await app.close();
  });
});
