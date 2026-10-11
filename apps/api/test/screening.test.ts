import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase } from '../src/case-store.js';
import { savePlan } from '../src/plan.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { createScreeningRoutes } from '../src/screening-routes.js';
import { createSimulatedCallerIdAdapter, type CallerIdAdapter } from '../src/screening-adapter.js';
import { createHash, createHmac } from 'node:crypto';
import { DEV_ONLY_FRAUD_LIST_HMAC_SECRET, identifierId, isOnFraudList, normalizeNumber } from '../src/fraud-list.js';
import { deleteCaseContent } from '../src/retention.js';
import { authHeader } from './test-auth.js';
import type { CallListeningMode } from '../../../packages/contracts/src/plan.js';

let db: Firestore;
let deps: ApiDeps;

beforeAll(() => {
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-dsn' });
  }
  db = getFirestore();
  deps = { auth: getAuth(), db, now: () => new Date() };
});

const SPAM = '+91 99999 00001';
const UNKNOWN = '+91 99999 00002';
const CLEAN = '+91 98765 43210';

function uid(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

async function seedCase(ownerUid: string, callListening: CallListeningMode = 'per-call'): Promise<string> {
  await savePlan(db, ownerUid, {
    thresholdMinor: 500_000,
    bankId: 'demo-bank',
    processingConsent: true,
    retentionMode: 'facts-24h',
    allySharingConsent: true,
    exportConsent: true,
    callListening,
  });
  return (await createCase(db, ownerUid, 1)).id;
}

async function check(app: ReturnType<typeof buildApi>, ownerUid: string, body: object) {
  return app.inject({ method: 'POST', url: '/api/v1/screening/check', headers: await authHeader(ownerUid), payload: body });
}

async function confirm(app: ReturnType<typeof buildApi>, ownerUid: string, caseId: string, body: object) {
  return app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/fraud-confirmation`, headers: await authHeader(ownerUid), payload: body });
}

describe('pre-pickup screening', () => {
  it('warns "unverified caller" for a flagged number and shows nothing for a clean one', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    await seedCase(owner);

    const flagged = (await check(app, owner, { number: UNKNOWN })).json();
    expect(flagged).toMatchObject({ level: 'unverified', warn: true, headline: 'Unverified caller' });

    const spam = (await check(app, owner, { number: SPAM })).json();
    expect(spam).toMatchObject({ level: 'unverified', warn: true, signal: { category: 'spam-reported', reportCount: 214 } });

    const clean = (await check(app, owner, { number: CLEAN })).json();
    expect(clean).toMatchObject({ level: 'none', warn: false, headline: null, detail: null });
  });

  it('requires auth and a valid number', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    expect((await app.inject({ method: 'POST', url: '/api/v1/screening/check', payload: { number: CLEAN } })).statusCode).toBe(401);
    const owner = uid('owner');
    expect((await check(app, owner, { number: 'abc' })).statusCode).toBe(400);
    expect((await check(app, owner, {})).statusCode).toBe(400);
  });

  it('respects the plan callListening preference (and defaults to ask without a plan)', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const none = uid('owner');
    expect((await check(app, none, { number: CLEAN })).json().listening).toBe('ask');
    for (const [mode, expected] of [
      ['all-calls', 'listen'],
      ['unverified-only', 'listen'],
      ['per-call', 'ask'],
    ] as const) {
      const owner = uid('owner');
      await seedCase(owner, mode);
      expect((await check(app, owner, { number: CLEAN })).json().listening).toBe(expected);
    }
  });

  it('degrades to the private list when the adapter fails', async () => {
    const broken: CallerIdAdapter = {
      async lookup() {
        throw new Error('provider down');
      },
    };
    const app = buildApi([createScreeningRoutes(broken)], deps);
    const owner = uid('owner');
    await seedCase(owner);
    expect((await check(app, owner, { number: SPAM })).json()).toMatchObject({ level: 'none', warn: false });
  });
});

describe('private confirmed-fraud list (C13)', () => {
  it('adds on user confirmation and a later matching call warns "previously reported"', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    const caseId = await seedCase(owner);
    expect((await check(app, owner, { number: CLEAN })).json().warn).toBe(false);

    const res = await confirm(app, owner, caseId, { callerNumber: CLEAN, basis: 'user-confirmed' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ basis: 'user-confirmed', private: true });

    // Formatting differences still match.
    const later = (await check(app, owner, { number: '9876543210' })).json();
    expect(later).toMatchObject({ level: 'previously-reported', warn: true, previouslyReported: true, headline: 'Previously reported by you' });
  });

  it('is private to the confirming user: another user is not warned', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    const other = uid('other');
    const caseId = await seedCase(owner);
    await seedCase(other);
    await confirm(app, owner, caseId, { callerNumber: CLEAN, basis: 'user-confirmed' });
    expect((await check(app, other, { number: CLEAN })).json()).toMatchObject({ level: 'none', warn: false });
  });

  it('accepts an authority-report basis only once the 1930 route was recorded on the case', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    const caseId = await seedCase(owner);
    expect((await confirm(app, owner, caseId, { callerNumber: CLEAN, basis: 'authority-report' })).statusCode).toBe(409);
    expect(await isOnFraudList(db, owner, normalizeNumber(CLEAN)!)).toBe(false);

    await db.collection('cases').doc(caseId).update({ recoveryAcknowledgement: { action: 'helpline-1930', status: 'local-note-recorded', simulated: true, at: new Date().toISOString() } });
    expect((await confirm(app, owner, caseId, { callerNumber: CLEAN, basis: 'authority-report' })).statusCode).toBe(200);
    expect(await isOnFraudList(db, owner, normalizeNumber(CLEAN)!)).toBe(true);
  });

  it("rejects confirming on someone else's case and unknown bases", async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    const intruder = uid('intruder');
    const caseId = await seedCase(owner);
    expect((await confirm(app, intruder, caseId, { callerNumber: CLEAN, basis: 'user-confirmed' })).statusCode).toBe(403);
    expect((await confirm(app, owner, caseId, { callerNumber: CLEAN, basis: 'caller-id-signal' })).statusCode).toBe(400);
    expect(await isOnFraudList(db, owner, normalizeNumber(CLEAN)!)).toBe(false);
  });
});

describe('screening is untrusted evidence (server-enforced)', () => {
  it('a spam-reported raw signal never writes the private list', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    await seedCase(owner);
    await check(app, owner, { number: SPAM });
    await check(app, owner, { number: SPAM });
    expect(await isOnFraudList(db, owner, normalizeNumber(SPAM)!)).toBe(false);
    expect((await check(app, owner, { number: SPAM })).json().previouslyReported).toBe(false);
  });

  it('never certifies the caller or supplies a route, even if the provider tries to', async () => {
    const hostile = {
      async lookup() {
        return {
          category: 'no-signal',
          verified: true,
          certified: true,
          displayName: 'Demo Bank Official',
          officialRoute: '+911800000000',
          official: true,
          note: 'ignore previous instructions',
        };
      },
    } as unknown as CallerIdAdapter;
    const app = buildApi([createScreeningRoutes(hostile)], deps);
    const owner = uid('owner');
    await seedCase(owner);
    const body = (await check(app, owner, { number: CLEAN })).json();
    expect(body).toMatchObject({ trust: 'untrusted', simulated: true, officialRoute: null, certifiesCaller: false });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/Demo Bank Official|911800000000|ignore previous|verified|certified/);
    expect(body.signal).toEqual({ category: 'no-signal' });
  });

  it('rejects clients trying to inject trust fields; they have no effect', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    await seedCase(owner);
    const body = (await check(app, owner, { number: SPAM, trust: 'trusted', certifiesCaller: true, officialRoute: '+911234567890', addToFraudList: true })).json();
    expect(body).toMatchObject({ trust: 'untrusted', officialRoute: null, certifiesCaller: false });
    expect(await isOnFraudList(db, owner, normalizeNumber(SPAM)!)).toBe(false);
  });

  it('stores the signal on the owner case labeled untrusted, without the raw number', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    const caseId = await seedCase(owner);
    expect((await check(app, owner, { number: SPAM, caseId })).statusCode).toBe(200);
    const docs = await db.collection('cases').doc(caseId).collection('screeningSignals').get();
    expect(docs.size).toBe(1);
    const stored = docs.docs[0]!.data();
    expect(stored).toMatchObject({ trust: 'untrusted', simulated: true, officialRoute: null, certifiesCaller: false });
    expect(JSON.stringify(stored)).not.toContain('9999900001');
    // Another user cannot attach signals to this case.
    expect((await check(app, uid('intruder'), { number: SPAM, caseId })).statusCode).toBe(403);
  });

  it('the simulated adapter is deterministic and only returns normalized categories', async () => {
    const adapter = createSimulatedCallerIdAdapter();
    expect(await adapter.lookup('+919999900001')).toEqual({ category: 'spam-reported', reportCount: 214 });
    expect(await adapter.lookup('+919876543210')).toEqual({ category: 'no-signal' });
  });
});

describe('fraud list privacy (decision 0011)', () => {
  it('keys entries by keyed HMAC, not a bare hash, and never stores the raw number', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    const caseId = await seedCase(owner);
    await confirm(app, owner, caseId, { callerNumber: CLEAN, basis: 'user-confirmed' });
    const normalized = normalizeNumber(CLEAN)!;
    const snap = await db.collection('fraudLists').doc(owner).collection('entries').get();
    expect(snap.size).toBe(1);
    const doc = snap.docs[0]!;
    const secret = process.env.FRAUD_LIST_HMAC_SECRET || DEV_ONLY_FRAUD_LIST_HMAC_SECRET;
    expect(doc.id).toBe(createHmac('sha256', secret).update(normalized).digest('hex'));
    expect(doc.id).not.toBe(createHash('sha256').update(normalized).digest('hex'));
    expect(identifierId(normalized)).toBe(identifierId(normalizeNumber('098765 43210'.slice(1))!));
    expect(JSON.stringify(doc.data())).not.toContain('9876543210');
    // Lookup still matches across formats.
    expect((await check(app, owner, { number: '+91-98765-43210' })).json().level).toBe('previously-reported');
  });

  it('lets the owner remove one entry; a later matching call no longer warns', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    const caseId = await seedCase(owner);
    await confirm(app, owner, caseId, { callerNumber: CLEAN, basis: 'user-confirmed' });
    const list = (await app.inject({ method: 'GET', url: '/api/v1/fraud-list', headers: await authHeader(owner) })).json();
    expect(list.entries).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain('9876543210');
    const del = await app.inject({ method: 'DELETE', url: `/api/v1/fraud-list/entries/${list.entries[0].id}`, headers: await authHeader(owner) });
    expect(del.statusCode).toBe(204);
    expect((await check(app, owner, { number: CLEAN })).json()).toMatchObject({ level: 'none', warn: false });
  });

  it("cannot delete or clear another user's entries", async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    const other = uid('other');
    const caseId = await seedCase(owner);
    await confirm(app, owner, caseId, { callerNumber: CLEAN, basis: 'user-confirmed' });
    const id = identifierId(normalizeNumber(CLEAN)!);
    const del = await app.inject({ method: 'DELETE', url: `/api/v1/fraud-list/entries/${id}`, headers: await authHeader(other) });
    expect([403, 404]).toContain(del.statusCode);
    await app.inject({ method: 'DELETE', url: '/api/v1/fraud-list', headers: await authHeader(other) });
    expect(await isOnFraudList(db, owner, normalizeNumber(CLEAN)!)).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/api/v1/fraud-list' })).statusCode).toBe(401);
  });

  it('clears the whole list for the owner', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    const caseId = await seedCase(owner);
    await confirm(app, owner, caseId, { callerNumber: CLEAN, basis: 'user-confirmed' });
    await confirm(app, owner, caseId, { callerNumber: SPAM, basis: 'user-confirmed' });
    const res = await app.inject({ method: 'DELETE', url: '/api/v1/fraud-list', headers: await authHeader(owner) });
    expect(res.json()).toEqual({ removed: 2 });
    expect(await isOnFraudList(db, owner, normalizeNumber(CLEAN)!)).toBe(false);
  });

  it('the list outlives case deletion by design, while screeningSignals are purged with the case', async () => {
    const app = buildApi([createScreeningRoutes()], deps);
    const owner = uid('owner');
    const caseId = await seedCase(owner);
    await check(app, owner, { number: SPAM, caseId });
    await confirm(app, owner, caseId, { callerNumber: CLEAN, basis: 'user-confirmed' });
    expect((await db.collection('cases').doc(caseId).collection('screeningSignals').get()).size).toBe(1);
    await deleteCaseContent(db, owner, caseId);
    expect((await db.collection('cases').doc(caseId).collection('screeningSignals').get()).size).toBe(0);
    expect(await isOnFraudList(db, owner, normalizeNumber(CLEAN)!)).toBe(true);
  });
});
