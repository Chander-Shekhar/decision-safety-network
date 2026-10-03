import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase, readCase } from '../src/case-store.js';
import { savePlan } from '../src/plan.js';
import { endSession, revokeProcessing } from '../src/session.js';
import { sessionRoutes } from '../src/session-routes.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { authHeader } from './test-auth.js';
import {
  closeSessionWithRetention,
  deleteCaseContent,
  promoteEvidence,
  revokeExportConsent,
  revokeRetentionConsent,
  sweepExpiredCases,
} from '../src/retention.js';
import { createEvidenceRoutes } from '../src/evidence-routes.js';
import { createRetentionRoutes, type SchedulerIdentityConfig } from '../src/retention-routes.js';
import type { RetainedCaseProjection, RetainedFact } from '../../../packages/contracts/src/evidence.js';

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

/** Saves a plan and creates a fresh case for it, mirroring facts.test.ts/decision.test.ts's own duplicated helper. */
async function seedCase(ownerUid: string, overrides: { exportConsent?: boolean } = {}): Promise<string> {
  await savePlan(db, ownerUid, {
    thresholdMinor: 500_000,
    bankId: 'demo-bank',
    processingConsent: true,
    retentionMode: 'facts-24h',
    allySharingConsent: true,
    exportConsent: overrides.exportConsent ?? true,
  });
  const created = await createCase(db, ownerUid, 1);
  return created.id;
}

/**
 * Seeds a case directly with events, segments, evidence, and an ally grant
 * (plan Step 1: "Seed case, events, segments, evidence, ally grants...
 * directly") plus a confirmed `claim` fact matching the plan's literal test
 * snippet. `ally.ts`/`ally-routes.ts` do not exist yet (DSN-011 is still
 * backlog), so `allyGrants` is seeded as a raw doc here rather than through a
 * real module - this task only needs the collection to exist and be emptied
 * by close/delete, not a real grant lifecycle.
 */
async function seedFullCase(ownerUid: string, overrides: { exportConsent?: boolean } = {}): Promise<string> {
  const caseId = await seedCase(ownerUid, overrides);
  const caseRef = db.collection('cases').doc(caseId);
  const now = new Date().toISOString();

  await caseRef.collection('segments').doc('s1').set({ id: 's1', caseId, order: 1, speaker: 'caller', text: 'Pay safe-new', expiresAt: now });
  await caseRef.collection('evidence').doc('s1').set({ id: 's1', caseId, segmentId: 's1', speaker: 'caller', text: 'Pay safe-new', order: 1, promotedAt: now });
  await caseRef.collection('events').doc('e1').set({
    id: 'e1',
    caseId,
    actorUid: ownerUid,
    kind: 'segment-accepted',
    at: now,
    causationId: 'e1',
    policyVersion: 'cup-core-1',
    refs: ['s1'],
    result: { id: caseId, version: 1, phase: 'Observe' },
  });
  await caseRef.collection('allyGrants').doc('g1').set({ id: 'g1', caseId, allyUid: uid('ally'), grantedAt: now });

  await caseRef.update({
    confirmed: {
      claim: { field: 'claim', value: 'Account compromised', origin: 'user-confirmed', sourceSegmentIds: ['s1'], uncertainty: 'low' },
    },
  });

  return caseId;
}

/** Narrows a retained confirmed-fact entry to its ordinary `RetainedFact` shape - used only where the test itself seeded that field as an ordinary fact, never a paid-payment entry. */
function asFact(entry: RetainedFact | { payeeId: string } | undefined): RetainedFact | undefined {
  return entry && 'value' in entry ? entry : undefined;
}

async function collectionEmpty(caseId: string, name: string): Promise<boolean> {
  return (await db.collection('cases').doc(caseId).collection(name).get()).empty;
}

describe('closeSessionWithRetention (literal plan Task 11 snippet)', () => {
  it('facts-24h prunes to the exact allowlist, retains confirmed facts as source-not-retained, and a later deleteCaseContent leaves an unlinkable tombstone', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);

    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    expect(await collectionEmpty(caseId, 'segments')).toBe(true);
    expect(await collectionEmpty(caseId, 'evidence')).toBe(true);
    expect(await collectionEmpty(caseId, 'events')).toBe(true);
    expect(await collectionEmpty(caseId, 'allyGrants')).toBe(true);

    const retained = await readCase<RetainedCaseProjection>(db, ownerUid, caseId);
    expect(Object.keys(retained).sort()).toEqual(
      ['confirmed', 'createdAt', 'expiresAt', 'exportConsent', 'id', 'ownerUid', 'phase', 'planVersion', 'retentionMode', 'updatedAt', 'version'].sort(),
    );
    expect(retained.confirmed.claim?.provenanceLabel).toBe('source not retained');
    expect(retained.confirmed.claim?.sourceIds).toEqual([]);

    await deleteCaseContent(db, ownerUid, caseId);
    for (const child of ['events', 'segments', 'evidence', 'allyGrants']) {
      expect(await collectionEmpty(caseId, child)).toBe(true);
    }
    expect((await db.collection('cases').doc(caseId).get()).exists).toBe(false);

    const tombstones = await db.collection('deletionTombstones').get();
    const ours = tombstones.docs.filter((d) => Object.keys(d.data()).length === 1);
    expect(ours.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(ours[0]!.data())).toEqual(['completedAt']);
    expect(ours[0]!.id).not.toBe(caseId);
  });
});

describe('closeSessionWithRetention: delete-on-close', () => {
  it('removes every descendant and the case document itself, in one step', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);

    await closeSessionWithRetention(db, ownerUid, caseId, 'delete-on-close');

    for (const child of ['events', 'segments', 'evidence', 'allyGrants']) {
      expect(await collectionEmpty(caseId, child)).toBe(true);
    }
    expect((await db.collection('cases').doc(caseId).get()).exists).toBe(false);
  });
});

describe('closeSessionWithRetention: selected-7d', () => {
  it('retains only promoted excerpts and marks their sourced facts as selected evidence, removing other events/grants', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    // seedFullCase already promoted segment s1 into evidence directly; this
    // models "the owner promoted the excerpt before close".

    await closeSessionWithRetention(db, ownerUid, caseId, 'selected-7d');

    expect(await collectionEmpty(caseId, 'events')).toBe(true);
    expect(await collectionEmpty(caseId, 'allyGrants')).toBe(true);
    expect(await collectionEmpty(caseId, 'segments')).toBe(true);
    const evidenceSnap = await db.collection('cases').doc(caseId).collection('evidence').get();
    expect(evidenceSnap.docs.map((d) => d.id)).toEqual(['s1']);

    const retained = await readCase<RetainedCaseProjection>(db, ownerUid, caseId);
    expect(retained.retentionMode).toBe('selected-7d');
    expect(retained.confirmed.claim?.provenanceLabel).toBe('selected evidence');
    expect(retained.confirmed.claim?.sourceIds).toEqual(['s1']);
  });

  it('marks a confirmed fact as source-not-retained when its citing segment was never promoted into evidence', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const caseRef = db.collection('cases').doc(caseId);
    await caseRef.collection('segments').doc('s1').set({ id: 's1', caseId, order: 1, speaker: 'caller', text: 'x', expiresAt: new Date().toISOString() });
    await caseRef.update({
      confirmed: { claim: { field: 'claim', value: 'Account compromised', origin: 'user-confirmed', sourceSegmentIds: ['s1'], uncertainty: 'low' } },
    });
    // Deliberately never promoted s1 into evidence before close.

    await closeSessionWithRetention(db, ownerUid, caseId, 'selected-7d');

    const retained = await readCase<RetainedCaseProjection>(db, ownerUid, caseId);
    expect(retained.confirmed.claim?.provenanceLabel).toBe('source not retained');
    expect(retained.confirmed.claim?.sourceIds).toEqual([]);
  });

  it('preserves a correction-superseded field distinctly from its promoted source excerpt (correction-preserving timeline while source is retained)', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const caseRef = db.collection('cases').doc(caseId);
    await caseRef.collection('segments').doc('s1').set({ id: 's1', caseId, order: 1, speaker: 'caller', text: 'Pay the wrong account', expiresAt: new Date().toISOString() });
    await promoteEvidence(db, ownerUid, caseId, 's1');
    await caseRef.update({
      confirmed: { payee: { field: 'payee', value: 'Known safe payee', origin: 'user-corrected', sourceSegmentIds: [], uncertainty: 'low' } },
    });

    await closeSessionWithRetention(db, ownerUid, caseId, 'selected-7d');

    const evidenceSnap = await caseRef.collection('evidence').get();
    expect(evidenceSnap.docs[0]?.data().text).toBe('Pay the wrong account');
    const retained = await readCase<RetainedCaseProjection>(db, ownerUid, caseId);
    // The user's correction (no source citation) stays distinct from the
    // still-available original excerpt - the timeline can show both without
    // the correction silently overwriting the retained source text.
    expect(asFact(retained.confirmed.payee)?.value).toBe('Known safe payee');
    expect(retained.confirmed.payee?.provenanceLabel).toBe('source not retained');
  });
});

describe('closeSessionWithRetention: preserved user-reported paid-payment fact', () => {
  it('keeps confirmed.paidPayment under facts-24h, labeled source-not-retained, distinct from any proposed payee/amount', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const caseRef = db.collection('cases').doc(caseId);
    await caseRef.update({
      confirmed: {
        payee: { field: 'payee', value: 'proposed-new-payee', origin: 'user-confirmed', sourceSegmentIds: [], uncertainty: 'low' },
        amount: { field: 'amount', value: '50000', origin: 'user-confirmed', sourceSegmentIds: [], uncertainty: 'low' },
        paidPayment: { payeeId: 'actual-safe-payee', amountMinor: 75000, origin: 'user-reported', reportedAt: new Date().toISOString() },
      },
    });

    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    const retained = await readCase<RetainedCaseProjection>(db, ownerUid, caseId);
    const paid = retained.confirmed.paidPayment as unknown as { payeeId: string; amountMinor: number; origin: string; provenanceLabel: string };
    expect(paid.payeeId).toBe('actual-safe-payee');
    expect(paid.amountMinor).toBe(75000);
    expect(paid.origin).toBe('user-reported');
    expect(paid.provenanceLabel).toBe('source not retained');
    // Proposed payee/amount remain their own separate, untouched entries.
    expect(asFact(retained.confirmed.payee)?.value).toBe('proposed-new-payee');
    expect(asFact(retained.confirmed.amount)?.value).toBe('50000');
  });
});

describe('closeSessionWithRetention: retry-safety and bypass prevention', () => {
  it('converges to the chosen pruned state when retried after an interruption simulated mid-close', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    const caseRef = db.collection('cases').doc(caseId);

    // Simulate "failure injected after raw purge": endSession already ran
    // (sessionClosed + segments gone) and `closing` was marked, but the mode
    // was never applied before the process died.
    await caseRef.update({ closing: true, closingMode: 'facts-24h', sessionClosed: true });
    await endSession(db, ownerUid, caseId);

    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    const retained = await readCase<RetainedCaseProjection>(db, ownerUid, caseId);
    expect(retained.retentionMode).toBe('facts-24h');
    expect(await collectionEmpty(caseId, 'events')).toBe(true);
    expect(await collectionEmpty(caseId, 'evidence')).toBe(true);
    expect(await collectionEmpty(caseId, 'allyGrants')).toBe(true);

    // Retrying again with the SAME mode after full convergence is a safe no-op.
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');
    const stillRetained = await readCase<RetainedCaseProjection>(db, ownerUid, caseId);
    expect(stillRetained.version).toBe(retained.version);
  });

  it('rejects a retry with a different mode once the case has already converged', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    await expect(closeSessionWithRetention(db, ownerUid, caseId, 'selected-7d')).rejects.toThrow('MODE_MISMATCH');
  });

  it('rejects a non-owner with FORBIDDEN', async () => {
    const ownerUid = uid('owner');
    const impostor = uid('impostor');
    const caseId = await seedFullCase(ownerUid);

    await expect(closeSessionWithRetention(db, impostor, caseId, 'facts-24h')).rejects.toThrow('FORBIDDEN');
  });

  it('a delete-on-close retry after full completion converges as an idempotent success', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'delete-on-close');

    await expect(closeSessionWithRetention(db, ownerUid, caseId, 'delete-on-close')).resolves.toBeUndefined();
  });

  it('a delete-on-close retry after completion converges, but a wrong owner on an EXISTING case is still FORBIDDEN', async () => {
    const ownerUid = uid('owner');
    const impostor = uid('impostor');
    const caseId = await seedFullCase(ownerUid);
    await expect(closeSessionWithRetention(db, impostor, caseId, 'delete-on-close')).rejects.toThrow('FORBIDDEN');
    expect((await db.collection('cases').doc(caseId).get()).exists).toBe(true);
  });

  it('no direct session route can bypass the sole close command: sessionRoutes exposes no close path, evidence-routes does', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    const headers = await authHeader(ownerUid);

    const bypassApp = buildApi([sessionRoutes], deps);
    const bypassAttempt = await bypassApp.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/session/close`, headers, payload: { mode: 'facts-24h' } });
    expect(bypassAttempt.statusCode).toBe(404);

    const evidenceApp = buildApi([createEvidenceRoutes()], deps);
    const realClose = await evidenceApp.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/session/close`, headers, payload: { mode: 'facts-24h' } });
    expect(realClose.statusCode).toBe(204);
  });
});

describe('POST /api/v1/cases/:id/session/close (real HTTP route, all three modes)', () => {
  it.each(['delete-on-close', 'facts-24h', 'selected-7d'] as const)('closes successfully under %s', async (mode) => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    const app = buildApi([createEvidenceRoutes()], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/session/close`,
      headers: await authHeader(ownerUid),
      payload: { mode },
    });

    expect(response.statusCode).toBe(204);
  });

  it('rejects a non-owner closing someone else\'s case with 403', async () => {
    const ownerUid = uid('owner');
    const impostor = uid('impostor');
    const caseId = await seedFullCase(ownerUid);
    const app = buildApi([createEvidenceRoutes()], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/session/close`,
      headers: await authHeader(impostor),
      payload: { mode: 'facts-24h' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects an unauthenticated close with 401', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    const app = buildApi([createEvidenceRoutes()], deps);

    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/session/close`, payload: { mode: 'facts-24h' } });
    expect(response.statusCode).toBe(401);
  });
});

describe('logical expiry and physical sweep', () => {
  it('blocks an owner read with EXPIRED/410 once expiresAt has passed, then sweepExpiredCases physically deletes it', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    // Force expiry into the past, as if 24h (or 7d) had already elapsed.
    await db.collection('cases').doc(caseId).update({ expiresAt: new Date(Date.now() - 1000).toISOString() });

    await expect(readCase(db, ownerUid, caseId)).rejects.toThrow('EXPIRED');
    expect((await db.collection('cases').doc(caseId).get()).exists).toBe(true);

    const { swept } = await sweepExpiredCases(db, () => new Date());
    expect(swept).toBeGreaterThanOrEqual(1);
    expect((await db.collection('cases').doc(caseId).get()).exists).toBe(false);
  });

  it('an export route read also rejects with 410 once a case has expired', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');
    await db.collection('cases').doc(caseId).update({ expiresAt: new Date(Date.now() - 1000).toISOString() });

    const app = buildApi([createEvidenceRoutes()], deps);
    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/export`, headers: await authHeader(ownerUid) });
    expect(response.statusCode).toBe(410);
  });

  it('sweeps in bounded pages and never touches an unrelated, unexpired case', async () => {
    const ownerUid = uid('owner');
    const otherOwnerUid = uid('other-owner');
    const expiredCaseId = await seedFullCase(ownerUid);
    const untouchedCaseId = await seedFullCase(otherOwnerUid);
    await closeSessionWithRetention(db, ownerUid, expiredCaseId, 'facts-24h');
    await db.collection('cases').doc(expiredCaseId).update({ expiresAt: new Date(Date.now() - 1000).toISOString() });

    await sweepExpiredCases(db, () => new Date());

    expect((await db.collection('cases').doc(expiredCaseId).get()).exists).toBe(false);
    expect((await db.collection('cases').doc(untouchedCaseId).get()).exists).toBe(true);
  });
});

describe('consent revocation', () => {
  it('export-consent revocation denies export immediately, even without closing the case', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    await revokeExportConsent(db, ownerUid, caseId);

    const app = buildApi([createEvidenceRoutes()], deps);
    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/export`, headers: await authHeader(ownerUid) });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'EXPORT_CONSENT_REQUIRED' });
  });

  it('rejects a non-owner revoking export consent', async () => {
    const ownerUid = uid('owner');
    const impostor = uid('impostor');
    const caseId = await seedFullCase(ownerUid);

    await expect(revokeExportConsent(db, impostor, caseId)).rejects.toThrow('FORBIDDEN');
  });

  it('retention-consent revocation purges selected excerpts and downgrades a selected-7d case to facts-24h', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'selected-7d');
    expect(await collectionEmpty(caseId, 'evidence')).toBe(false);

    await revokeRetentionConsent(db, ownerUid, caseId, 'facts-24h');

    expect(await collectionEmpty(caseId, 'evidence')).toBe(true);
    const retained = await readCase<RetainedCaseProjection>(db, ownerUid, caseId);
    expect(retained.retentionMode).toBe('facts-24h');
    expect(retained.confirmed.claim?.provenanceLabel).toBe('source not retained');
  });

  it('retention-consent revocation can instead immediately delete everything, at the user\'s choice', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'selected-7d');

    await revokeRetentionConsent(db, ownerUid, caseId, 'delete-on-close');

    expect((await db.collection('cases').doc(caseId).get()).exists).toBe(false);
  });
});

describe('promoteEvidence', () => {
  it('promotes an existing segment, idempotently on repeat calls', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    await db.collection('cases').doc(caseId).collection('segments').doc('s1').set({ id: 's1', caseId, order: 1, speaker: 'caller', text: 'hello', expiresAt: new Date().toISOString() });

    const first = await promoteEvidence(db, ownerUid, caseId, 's1');
    const second = await promoteEvidence(db, ownerUid, caseId, 's1');
    expect(first).toEqual(second);
    expect(first.text).toBe('hello');
  });

  it('rejects promoting a segment that does not exist', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    await expect(promoteEvidence(db, ownerUid, caseId, 'ghost')).rejects.toThrow('SEGMENT_NOT_FOUND');
  });

  it('rejects promotion once the session has closed', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    await db.collection('cases').doc(caseId).collection('segments').doc('s1').set({ id: 's1', caseId, order: 1, speaker: 'caller', text: 'hello', expiresAt: new Date().toISOString() });
    await revokeProcessing(db, ownerUid, caseId);
    await endSession(db, ownerUid, caseId);

    await expect(promoteEvidence(db, ownerUid, caseId, 's1')).rejects.toThrow('SESSION_CLOSED');
  });

  it('rejects a non-owner', async () => {
    const ownerUid = uid('owner');
    const impostor = uid('impostor');
    const caseId = await seedCase(ownerUid);
    await db.collection('cases').doc(caseId).collection('segments').doc('s1').set({ id: 's1', caseId, order: 1, speaker: 'caller', text: 'hello', expiresAt: new Date().toISOString() });

    await expect(promoteEvidence(db, impostor, caseId, 's1')).rejects.toThrow('FORBIDDEN');
  });
});

describe('revoked ally blocked after close/deletion (data-layer proxy test)', () => {
  // `ally.ts`/`ally-routes.ts` do not exist yet (DSN-011 is still backlog), so
  // there is no real ally-read route to exercise end-to-end. This proxies the
  // acceptance ("revoked ally blocked after close/deletion") at the data
  // layer: once close/delete has emptied `allyGrants`, no stored grant
  // remains for any ally-facing route to ever read, regardless of its prior
  // revoked/accepted state.
  it('empties allyGrants on close under every retention mode', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');
    expect(await collectionEmpty(caseId, 'allyGrants')).toBe(true);
  });

  it('empties allyGrants on immediate deletion', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await deleteCaseContent(db, ownerUid, caseId);
    expect((await db.collection('cases').doc(caseId).collection('allyGrants').get()).empty).toBe(true);
  });
});

describe('an unrelated case is never touched', () => {
  it('deleteCaseContent on one case leaves a second, unrelated case fully intact', async () => {
    const ownerA = uid('owner-a');
    const ownerB = uid('owner-b');
    const caseA = await seedFullCase(ownerA);
    const caseB = await seedFullCase(ownerB);

    await deleteCaseContent(db, ownerA, caseA);

    expect((await db.collection('cases').doc(caseA).get()).exists).toBe(false);
    expect((await db.collection('cases').doc(caseB).get()).exists).toBe(true);
    expect(await collectionEmpty(caseB, 'segments')).toBe(false);
  });
});

describe('DSN-013 review fixes', () => {
  const HOUR = 60 * 60 * 1000;

  it('B3: revoking retention consent on a selected-7d case near expiry never LENGTHENS its life', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'selected-7d');
    const soon = new Date(Date.now() + HOUR).toISOString();
    await db.collection('cases').doc(caseId).update({ expiresAt: soon });

    await revokeRetentionConsent(db, ownerUid, caseId, 'facts-24h');

    const after = (await db.collection('cases').doc(caseId).get()).data() as RetainedCaseProjection;
    expect(after.retentionMode).toBe('facts-24h');
    expect((after.expiresAt ?? '') <= soon).toBe(true);
  });

  it('B3: revoking retention consent still caps a far-future expiry at 24h', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'selected-7d');

    await revokeRetentionConsent(db, ownerUid, caseId, 'facts-24h');

    const after = (await db.collection('cases').doc(caseId).get()).data() as RetainedCaseProjection;
    expect(Date.parse(after.expiresAt ?? '')).toBeLessThanOrEqual(Date.now() + 24 * HOUR + 1000);
  });

  it('B3: mutators reject an already-expired-but-unswept case rather than resurrecting it', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'selected-7d');
    const past = new Date(Date.now() - 1000).toISOString();
    const ref = db.collection('cases').doc(caseId);
    await ref.update({ expiresAt: past });

    await expect(revokeRetentionConsent(db, ownerUid, caseId, 'facts-24h')).rejects.toThrow('EXPIRED');
    await expect(revokeExportConsent(db, ownerUid, caseId)).rejects.toThrow('EXPIRED');
    await expect(promoteEvidence(db, ownerUid, caseId, 's1')).rejects.toThrow('EXPIRED');

    const after = (await ref.get()).data() as RetainedCaseProjection;
    expect(after.expiresAt).toBe(past);
    expect(after.retentionMode).toBe('selected-7d');
    expect(after.exportConsent).toBe(true);
  });

  it('B2: the final prune write rejects (instead of clobbering) when the case version advanced mid-prune', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    const ref = db.collection('cases').doc(caseId);

    await expect(
      closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h', {
        beforeFinalWrite: async () => {
          const snap = await ref.get();
          await ref.update({ version: (snap.data() as { version: number }).version + 1, concurrentMarker: 'kept' });
        },
      }),
    ).rejects.toThrow('CONCURRENT_MODIFICATION');

    const midState = (await ref.get()).data() as Record<string, unknown>;
    expect(midState.concurrentMarker).toBe('kept');
    expect(midState.closing).toBe(true);

    // A plain retry converges.
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');
    const retained = await readCase<RetainedCaseProjection>(db, ownerUid, caseId);
    expect(retained.retentionMode).toBe('facts-24h');
    expect(Object.keys(retained)).not.toContain('concurrentMarker');
  });

  it('N3: deleteCaseContent, delete-on-close and prune also remove an unexpected extra subcollection', async () => {
    for (const mode of ['delete-on-close', 'facts-24h', 'selected-7d'] as const) {
      const ownerUid = uid('owner');
      const caseId = await seedFullCase(ownerUid);
      await db.collection('cases').doc(caseId).collection('mysteryChild').doc('x').set({ secret: 'leak' });
      await closeSessionWithRetention(db, ownerUid, caseId, mode);
      expect(await collectionEmpty(caseId, 'mysteryChild')).toBe(true);
    }
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await db.collection('cases').doc(caseId).collection('mysteryChild').doc('x').set({ secret: 'leak' });
    await deleteCaseContent(db, ownerUid, caseId);
    expect(await collectionEmpty(caseId, 'mysteryChild')).toBe(true);
  });

  it('N4: one failing case does not abort the sweep, and failures are counted', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const ownerUid = uid('owner');
      const caseId = await seedFullCase(ownerUid);
      await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');
      await db.collection('cases').doc(caseId).update({ expiresAt: new Date(Date.now() - 1000).toISOString() });
      ids.push(caseId);
    }
    const poison = ids[0]!;

    const result = await sweepExpiredCases(db, () => new Date(), async (dbArg, ownerUid, caseId) => {
      if (caseId === poison) {
        throw new Error('boom');
      }
      await deleteCaseContent(dbArg, ownerUid, caseId);
    });

    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect(result.swept).toBeGreaterThanOrEqual(2);
    expect((await db.collection('cases').doc(poison).get()).exists).toBe(true);
    for (const id of ids.slice(1)) {
      expect((await db.collection('cases').doc(id).get()).exists).toBe(false);
    }
    await deleteCaseContent(db, String((await db.collection('cases').doc(poison).get()).get('ownerUid')), poison);
  });
});

describe('POST /internal/retention/sweep (scheduler OIDC gating)', () => {
  async function buildSchedulerKeypairConfig(): Promise<{ config: SchedulerIdentityConfig; signToken: (claims: Record<string, unknown>) => string }> {
    const { generateKeyPairSync, createSign } = await import('node:crypto');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const kid = 'test-key-1';
    const audience = 'https://api.example.test/internal/retention/sweep';
    const serviceAccountEmail = 'scheduler@demo-dsn.iam.gserviceaccount.com';

    function base64Url(input: Buffer | string): string {
      return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function signToken(claims: Record<string, unknown>): string {
      const header = { alg: 'RS256', kid, typ: 'JWT' };
      const payload = {
        aud: audience,
        email: serviceAccountEmail,
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 300,
        iss: 'https://accounts.google.com',
        ...claims,
      };
      const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
      const signer = createSign('RSA-SHA256');
      signer.update(signingInput);
      signer.end();
      const signature = signer.sign(privateKey);
      return `${signingInput}.${base64Url(signature)}`;
    }

    const config: SchedulerIdentityConfig = {
      audience,
      serviceAccountEmail,
      keySource: { async getPublicKey(requestedKid: string) { return requestedKid === kid ? publicKey.export({ type: 'spki', format: 'pem' }).toString() : undefined; } },
    };
    return { config, signToken };
  }

  it('accepts a valid self-signed scheduler token and performs the sweep', async () => {
    const { config, signToken } = await buildSchedulerKeypairConfig();
    const ownerUid = uid('owner');
    const caseId = await seedFullCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');
    await db.collection('cases').doc(caseId).update({ expiresAt: new Date(Date.now() - 1000).toISOString() });

    const app = buildApi([createRetentionRoutes(config)], deps);
    const response = await app.inject({
      method: 'POST',
      url: '/internal/retention/sweep',
      headers: { authorization: `Bearer ${signToken({})}` },
    });

    expect(response.statusCode).toBe(200);
    expect((await db.collection('cases').doc(caseId).get()).exists).toBe(false);
  });

  it('rejects a request with no authorization header', async () => {
    const { config } = await buildSchedulerKeypairConfig();
    const app = buildApi([createRetentionRoutes(config)], deps);
    const response = await app.inject({ method: 'POST', url: '/internal/retention/sweep' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a real Firebase user ID token - a Firebase user can never invoke the scheduler-only sweep', async () => {
    const { config } = await buildSchedulerKeypairConfig();
    const ownerUid = uid('owner');
    const app = buildApi([createRetentionRoutes(config)], deps);
    const headers = await authHeader(ownerUid);

    const response = await app.inject({ method: 'POST', url: '/internal/retention/sweep', headers });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a scheduler-shaped token with the wrong audience', async () => {
    const { signToken } = await buildSchedulerKeypairConfig();
    const { config: wrongAudienceConfig } = await buildSchedulerKeypairConfig();
    const app = buildApi([createRetentionRoutes(wrongAudienceConfig)], deps);

    const response = await app.inject({
      method: 'POST',
      url: '/internal/retention/sweep',
      headers: { authorization: `Bearer ${signToken({})}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a scheduler-shaped token with the wrong service account email', async () => {
    const { config, signToken } = await buildSchedulerKeypairConfig();
    const app = buildApi([createRetentionRoutes(config)], deps);

    const response = await app.inject({
      method: 'POST',
      url: '/internal/retention/sweep',
      headers: { authorization: `Bearer ${signToken({ email: 'someone-else@example.com' })}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects an expired scheduler token', async () => {
    const { config, signToken } = await buildSchedulerKeypairConfig();
    const app = buildApi([createRetentionRoutes(config)], deps);

    const response = await app.inject({
      method: 'POST',
      url: '/internal/retention/sweep',
      headers: { authorization: `Bearer ${signToken({ exp: Math.floor(Date.now() / 1000) - 10 })}` },
    });
    expect(response.statusCode).toBe(401);
  });
});
