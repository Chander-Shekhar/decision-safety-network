import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase, readCase } from '../src/case-store.js';
import { savePlan } from '../src/plan.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { authHeader } from './test-auth.js';
import { correctFact } from '../src/fact-validator.js';
import { closeSessionWithRetention } from '../src/retention.js';
import { confirmPaidDetails, enterRecovery } from '../src/recovery.js';
import { createRecoveryRoutes } from '../src/recovery-routes.js';
import type { Phase } from '../../../packages/contracts/src/case.js';
import type { GeminiPort } from '../../../packages/contracts/src/facts.js';
import type { RecoveryProjection } from '../../../packages/contracts/src/recovery.js';
import type { RetainedCaseProjection } from '../../../packages/contracts/src/evidence.js';

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

const gemini: GeminiPort = { extract: vi.fn(), relate: vi.fn() };

function confirmedFact(field: string, value: string, sourceSegmentIds: string[] = ['s1']) {
  return { field, value, origin: 'user-confirmed', sourceSegmentIds, uncertainty: 'low' };
}

interface SeedOptions {
  phase?: Phase;
  draft?: boolean;
  payee?: string;
  amount?: string;
  paymentState?: string;
}

/** Saves a plan, creates a case, and seeds phase/confirmed facts/draft directly (synthetic data only). */
async function seedCase(ownerUid: string, options: SeedOptions = {}): Promise<string> {
  await savePlan(db, ownerUid, {
    thresholdMinor: 500_000,
    bankId: 'demo-bank',
    processingConsent: true,
    retentionMode: 'facts-24h',
    allySharingConsent: true,
    exportConsent: true,
  });
  const { id } = await createCase(db, ownerUid, 1);
  const confirmed: Record<string, unknown> = {
    claimedIdentity: confirmedFact('claimedIdentity', 'Bank fraud desk'),
    centralClaim: confirmedFact('centralClaim', 'Account compromised'),
  };
  if (options.payee !== undefined) confirmed.payee = confirmedFact('payee', options.payee);
  if (options.amount !== undefined) confirmed.amount = confirmedFact('amount', options.amount);
  const update: Record<string, unknown> = { phase: options.phase ?? 'Pause', confirmed };
  if (options.draft !== false) {
    update.paymentDraft = { id: randomUUID(), beneficiaryId: 'safe-new', amountMinor: 5_000_000, newPayee: true, version: 1 };
    update.paymentState = options.paymentState ?? 'pending';
  }
  await db.collection('cases').doc(id).update(update);
  return id;
}

const PHASES_INTO_RECOVER: Phase[] = ['Observe', 'Check', 'Pause', 'Verify', 'Resolve'];

describe('enterRecovery (literal plan Task 10 snippet)', () => {
  it('enters Recover on the same case, prefills from the simulated draft, leaves paidPayment null, and never calls Gemini', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    const before = await readCase<RecoveryProjection>(db, u, c);
    const recovery = await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    expect(recovery.caseId).toBe(before.id);
    expect(recovery.proposedPayment!.amountMinor).toBe(before.paymentDraft!.amountMinor);
    expect(recovery.proposedPayment!.source).toBe('simulated-draft');
    expect(recovery.paidPayment).toBeNull();
    expect(recovery.missing).toContain('paidAmountMinor');
    expect(recovery.bankAction).toEqual({ status: 'ready', route: 'Demo Bank', simulated: true });
    expect(recovery.helpline1930Action).toEqual({
      status: 'ready',
      route: '1930',
      sourceUrl: 'https://cybercrime.gov.in/',
      reviewedAt: '2026-10-02',
    });
    expect(gemini.extract).not.toHaveBeenCalled();
    expect(gemini.relate).not.toHaveBeenCalled();

    const reported = await confirmPaidDetails(db, u, c, {
      kind: 'match-prefill',
      expectedPrefillFingerprint: recovery.proposedPayment!.fingerprint,
      key: randomUUID(),
    });
    expect(reported.paidPayment).toMatchObject({ paidAmountMinor: before.paymentDraft!.amountMinor, origin: 'user-reported' });
    expect(reported.paidPayment!.paidPayee).toBe('safe-new');
  });

  it('does not import or call the model module', () => {
    const source = readFileSync(new URL('../src/recovery.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/gemini|genai/i);
  });
});

describe('enterRecovery: same case from every entry state', () => {
  for (const phase of PHASES_INTO_RECOVER) {
    it(`enters Recover from ${phase} on the same case id, bumping version exactly once, reusing confirmed facts`, async () => {
      const u = uid('owner');
      const c = await seedCase(u, { phase });
      const before = await readCase<RecoveryProjection>(db, u, c);
      const state = await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
      const after = await readCase<RecoveryProjection>(db, u, c);
      expect(after.phase).toBe('Recover');
      expect(after.id).toBe(before.id);
      expect(after.version).toBe(before.version + 1);
      expect(state.known.facts.centralClaim).toBe('Account compromised');
      expect(state.known.facts.claimedIdentity).toBe('Bank fraud desk');
      const cases = await db.collection('cases').where('ownerUid', '==', u).get();
      expect(cases.size).toBe(1);
      const events = await db.collection('cases').doc(c).collection('events').get();
      expect(events.docs.filter((d) => d.get('kind') === 'already-paid')).toHaveLength(1);
    });
  }

  it('is idempotent on retry with the same key and does not double-bump the version', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    const key = randomUUID();
    await enterRecovery(db, u, c, { kind: 'already-paid', key });
    const mid = await readCase(db, u, c);
    await enterRecovery(db, u, c, { kind: 'already-paid', key });
    const after = await readCase(db, u, c);
    expect(after.version).toBe(mid.version);
  });

  it('re-entering while already in Recover with a new key stays in Recover without an illegal edge', async () => {
    const u = uid('owner');
    const c = await seedCase(u, { phase: 'Recover' });
    await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    expect((await readCase(db, u, c)).phase).toBe('Recover');
  });

  it('rejects a non-owner with FORBIDDEN and an invalid idempotency key', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    await expect(enterRecovery(db, uid('other'), c, { kind: 'already-paid', key: randomUUID() })).rejects.toThrow('FORBIDDEN');
    await expect(enterRecovery(db, u, c, { kind: 'already-paid', key: 'not-a-uuid' })).rejects.toThrow('INVALID_IDEMPOTENCY_KEY');
    expect((await readCase(db, u, c)).phase).toBe('Pause');
  });
});

describe('proposed vs paid', () => {
  it('a cancelled simulated proposal followed by "I already paid" never populates paidPayment', async () => {
    const u = uid('owner');
    const c = await seedCase(u, { paymentState: 'cancelled' });
    const state = await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    expect(state.paidPayment).toBeNull();
    expect(state.missing).toEqual(expect.arrayContaining(['paidPayee', 'paidAmountMinor']));
    const stored = await readCase<RecoveryProjection>(db, u, c);
    expect(stored.confirmed.paidPayment).toBeUndefined();
  });

  it('entry retries never populate paidPayment; only an explicit owner match does', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    expect((await readCase<RecoveryProjection>(db, u, c)).confirmed.paidPayment).toBeUndefined();
  });

  it('match-prefill stores a distinct user-reported paidPayment and leaves unknown time/reference blank and prompted', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    const state = await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    const reported = await confirmPaidDetails(db, u, c, {
      kind: 'match-prefill',
      expectedPrefillFingerprint: state.proposedPayment!.fingerprint,
      key: randomUUID(),
    });
    expect(reported.paidPayment).toEqual({ paidPayee: 'safe-new', paidAmountMinor: 5_000_000, origin: 'user-reported' });
    expect(reported.missing).toEqual(['transactionTime', 'paymentRail', 'referenceId']);
    const stored = await readCase<RecoveryProjection>(db, u, c);
    expect(stored.confirmed.paidPayment).toMatchObject({ payeeId: 'safe-new', amountMinor: 5_000_000, origin: 'user-reported' });
    // the proposed draft is untouched and stays a separate record
    expect(stored.paymentDraft).toMatchObject({ beneficiaryId: 'safe-new', amountMinor: 5_000_000 });
  });

  it('edit stores only what the user entered, not the prefill', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    const reported = await confirmPaidDetails(db, u, c, {
      kind: 'edit-paid-details',
      paidPayee: 'other-payee',
      paidAmountMinor: 1_234_500,
      referenceId: 'REF123',
      key: randomUUID(),
    });
    expect(reported.paidPayment).toEqual({
      paidPayee: 'other-payee',
      paidAmountMinor: 1_234_500,
      referenceId: 'REF123',
      origin: 'user-reported',
    });
    expect(reported.missing).toEqual(['transactionTime', 'paymentRail']);
  });

  it('rejects an invalid edit', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    await expect(
      confirmPaidDetails(db, u, c, { kind: 'edit-paid-details', paidPayee: '', paidAmountMinor: 100, key: randomUUID() }),
    ).rejects.toThrow('INVALID_PAID_DETAILS');
    await expect(
      confirmPaidDetails(db, u, c, { kind: 'edit-paid-details', paidPayee: 'x', paidAmountMinor: -5, key: randomUUID() }),
    ).rejects.toThrow('INVALID_PAID_DETAILS');
  });

  it('rejects a stale prefill fingerprint BEFORE copying values', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    const state = await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    // the draft changes between display and click
    await db.collection('cases').doc(c).update({
      paymentDraft: { id: randomUUID(), beneficiaryId: 'safe-new', amountMinor: 9_000_000, newPayee: true, version: 2 },
    });
    await expect(
      confirmPaidDetails(db, u, c, { kind: 'match-prefill', expectedPrefillFingerprint: state.proposedPayment!.fingerprint, key: randomUUID() }),
    ).rejects.toThrow('STALE_PREFILL');
    expect((await readCase<RecoveryProjection>(db, u, c)).confirmed.paidPayment).toBeUndefined();
  });

  it('offers no one-tap match with an incomplete prefill, and rejects match-prefill', async () => {
    const u = uid('owner');
    const c = await seedCase(u, { draft: false, payee: 'safe-new' }); // amount missing
    const state = await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    expect(state.proposedPayment).toBeNull();
    await expect(
      confirmPaidDetails(db, u, c, { kind: 'match-prefill', expectedPrefillFingerprint: 'anything', key: randomUUID() }),
    ).rejects.toThrow('NO_PREFILL');
  });

  it('treats an unknown placeholder caller-request as incomplete', async () => {
    const u = uid('owner');
    const c = await seedCase(u, { draft: false, payee: 'unknown', amount: '50000' });
    const state = await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    expect(state.proposedPayment).toBeNull();
  });

  it('confirmPaidDetails before entering Recover is rejected', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    await expect(
      confirmPaidDetails(db, u, c, { kind: 'edit-paid-details', paidPayee: 'x', paidAmountMinor: 1, key: randomUUID() }),
    ).rejects.toThrow('NOT_IN_RECOVERY');
  });

  it('match/edit is idempotent on retry with the same key and owner-only', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    const state = await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    const key = randomUUID();
    const command = { kind: 'match-prefill' as const, expectedPrefillFingerprint: state.proposedPayment!.fingerprint, key };
    await confirmPaidDetails(db, u, c, command);
    const mid = await readCase(db, u, c);
    await confirmPaidDetails(db, u, c, command);
    expect((await readCase(db, u, c)).version).toBe(mid.version);
    await expect(confirmPaidDetails(db, uid('other'), c, command)).rejects.toThrow('FORBIDDEN');
  });

  it('generic model-fact correct/confirm cannot set paidPayment', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    const version = (await readCase(db, u, c)).version;
    await expect(correctFact(db, u, c, 'paidPayment', 'safe-new', version)).rejects.toThrow('UNKNOWN_FIELD');
  });
});

describe('default retention after close', () => {
  it('reuses confirmed caller-request context labeled "source not retained", never as a surviving simulated draft, and keeps paidPayment', async () => {
    const u = uid('owner');
    const c = await seedCase(u, { payee: 'safe-new', amount: '5000000', phase: 'Pause' });
    await closeSessionWithRetention(db, u, c, 'facts-24h');
    const retained = await readCase<RetainedCaseProjection>(db, u, c);
    expect(retained.retentionMode).toBe('facts-24h');
    expect('paymentDraft' in retained).toBe(false);

    const state = await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    expect(state.proposedPayment).toMatchObject({
      source: 'caller-request',
      sourceRetained: false,
      payee: 'safe-new',
      amountMinor: 5_000_000,
    });
    expect(state.proposedPayment!.sourceLabel).toMatch(/source not retained/i);
    expect(state.proposedPayment!.sourceLabel).not.toMatch(/simulated draft/i);
    expect(state.paidPayment).toBeNull();
    expect(state.bankAction.status).toBe('ready');
    expect(state.helpline1930Action.status).toBe('ready');

    await confirmPaidDetails(db, u, c, {
      kind: 'match-prefill',
      expectedPrefillFingerprint: state.proposedPayment!.fingerprint,
      key: randomUUID(),
    });
    const stored = await readCase<RetainedCaseProjection>(db, u, c);
    expect(stored.confirmed.paidPayment).toMatchObject({ payeeId: 'safe-new', amountMinor: 5_000_000, origin: 'user-reported' });
    expect(stored.phase).toBe('Recover');
  });

  it('prefers a retained simulated draft over caller-request facts while the draft survives', async () => {
    const u = uid('owner');
    const c = await seedCase(u, { payee: 'other', amount: '100' });
    const state = await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    expect(state.proposedPayment!.source).toBe('simulated-draft');
    expect(state.proposedPayment!.sourceRetained).toBe(true);
  });

  it('a live caller-request prefill (no draft) is labeled caller-request with a retained source', async () => {
    const u = uid('owner');
    const c = await seedCase(u, { draft: false, payee: 'safe-new', amount: '5000000' });
    const state = await enterRecovery(db, u, c, { kind: 'already-paid', key: randomUUID() });
    expect(state.proposedPayment).toMatchObject({ source: 'caller-request', sourceRetained: true });
  });
});

describe('recovery routes (installed in isolation)', () => {
  it('enter -> state -> match -> acknowledgement works end to end with no model dependency', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    const app = buildApi([createRecoveryRoutes()], deps);
    const headers = await authHeader(u);

    const entered = await app.inject({ method: 'POST', url: `/api/v1/cases/${c}/recovery/enter`, headers, payload: { idempotencyKey: randomUUID() } });
    expect(entered.statusCode).toBe(200);
    const state = entered.json();
    expect(state.bankAction.simulated).toBe(true);
    expect(state.paidPayment).toBeNull();

    const read = await app.inject({ method: 'GET', url: `/api/v1/cases/${c}/recovery`, headers });
    expect(read.statusCode).toBe(200);
    expect(read.json().proposedPayment.fingerprint).toBe(state.proposedPayment.fingerprint);

    const stale = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${c}/recovery/paid-details`,
      headers,
      payload: { kind: 'match-prefill', expectedPrefillFingerprint: 'stale', idempotencyKey: randomUUID() },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error).toBe('STALE_PREFILL');

    const matched = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${c}/recovery/paid-details`,
      headers,
      payload: { kind: 'match-prefill', expectedPrefillFingerprint: state.proposedPayment.fingerprint, idempotencyKey: randomUUID() },
    });
    expect(matched.statusCode).toBe(200);
    expect(matched.json().paidPayment.origin).toBe('user-reported');

    const ack = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${c}/recovery/acknowledgement`,
      headers,
      payload: { action: 'bank', idempotencyKey: randomUUID() },
    });
    expect(ack.statusCode).toBe(200);
    expect(ack.json().acknowledgement).toMatchObject({ action: 'bank', status: 'local-note-recorded', simulated: true });
    await app.close();
  });

  it('denies unauthenticated and non-owner callers and rejects malformed bodies', async () => {
    const u = uid('owner');
    const c = await seedCase(u);
    const app = buildApi([createRecoveryRoutes()], deps);
    const noAuth = await app.inject({ method: 'POST', url: `/api/v1/cases/${c}/recovery/enter`, payload: { idempotencyKey: randomUUID() } });
    expect(noAuth.statusCode).toBe(401);
    const other = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${c}/recovery/enter`,
      headers: await authHeader(uid('other')),
      payload: { idempotencyKey: randomUUID() },
    });
    expect(other.statusCode).toBe(403);
    const bad = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${c}/recovery/paid-details`,
      headers: await authHeader(u),
      payload: { kind: 'edit-paid-details', paidPayee: 'x' },
    });
    expect(bad.statusCode).toBe(400);
    await app.close();
  });
});
