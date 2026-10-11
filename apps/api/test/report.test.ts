import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase } from '../src/case-store.js';
import { savePlan } from '../src/plan.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { authHeader } from './test-auth.js';
import { enterRecovery } from '../src/recovery.js';
import { addConfirmedFraud, isOnFraudList, listFraudEntries, normalizeNumber } from '../src/fraud-list.js';
import { buildReportDraft, renderReportDraftHtml, SIMULATED_NCRP_CHANNEL_URL } from '../src/report.js';
import { createReportRoutes } from '../src/report-routes.js';
import { createScreeningRoutes } from '../src/screening-routes.js';
import type { ManifestFact } from '../../../packages/contracts/src/evidence.js';

let db: Firestore;
let deps: ApiDeps;

beforeAll(() => {
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-dsn' });
  }
  db = getFirestore();
  deps = { auth: getAuth(), db, now: () => new Date() };
});

const CALLER = '+91 98765 43210';

function uid(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function fact(field: string, value: string, origin = 'user-confirmed'): ManifestFact {
  return { field, value, origin, sourceIds: [], provenanceLabel: 'source not retained', correctedAt: null };
}

function confirmedFact(field: string, value: string, origin = 'user-confirmed') {
  return { field, value, origin, sourceSegmentIds: ['s1'], uncertainty: 'low' };
}

async function seedCase(ownerUid: string, enterRecover: boolean): Promise<string> {
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
      claimedIdentity: confirmedFact('claimedIdentity', 'Bank fraud desk'),
      centralClaim: confirmedFact('centralClaim', 'Account compromised', 'user-corrected'),
      requestedAction: confirmedFact('requestedAction', 'Guessed by model', 'model'),
    },
  });
  if (enterRecover) {
    await enterRecovery(db, ownerUid, id, { kind: 'already-paid', key: randomUUID() });
  }
  return id;
}

describe('buildReportDraft (pure)', () => {
  it('pre-fills only confirmed facts, leaves unknown/unsupported/model-origin fields blank, and never fabricates', () => {
    const draft = buildReportDraft('c1', [fact('claimedIdentity', 'Bank fraud desk'), fact('requestedAction', 'Pay now', 'model')]);
    const byName = Object.fromEntries(draft.fields.map((f) => [f.ncrpField, f]));
    expect(byName["Caller's claimed identity"]).toMatchObject({ value: 'Bank fraud desk', blank: false });
    expect(byName["Caller's claimed identity"]!.provenance).toMatchObject({ origin: 'user-confirmed', provenanceLabel: 'source not retained' });
    expect(byName['Requested action']).toMatchObject({ value: '', blank: true, provenance: null });
    expect(byName['Complainant name']).toMatchObject({ value: '', blank: true });
    expect(byName['Transaction reference']).toMatchObject({ value: '', blank: true });
  });

  it('is labeled a not-submitted simulated draft, source-dated, with a recovery-scam warning and a user-action synthetic handoff', () => {
    const draft = buildReportDraft('c1', []);
    expect(draft.label).toBe('Draft for your review — not submitted');
    expect(draft.submitted).toBe(false);
    expect(draft.simulated).toBe(true);
    expect(draft.sourceDate).toBe('2026-10-02');
    expect(draft.recoveryScamWarning).toMatch(/recovery scams?/i);
    expect(draft.handoff).toMatchObject({ requiresUserAction: true, simulated: true, channelUrl: SIMULATED_NCRP_CHANNEL_URL });
    expect(new URL(draft.handoff.channelUrl).hostname.endsWith('.invalid')).toBe(true);
    expect(draft.fields.every((f) => f.blank)).toBe(true);
  });

  it('downloadable HTML escapes values, carries the not-submitted label and warning, and never claims filed/accepted', () => {
    const html = renderReportDraftHtml(buildReportDraft('c1', [fact('centralClaim', '<script>x</script>')]));
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Draft for your review');
    expect(html).toMatch(/recovery scams?/i);
    expect(html).not.toMatch(/\b(has been|was) (filed|submitted|accepted)\b/i);
  });
});

describe('report routes', () => {
  it('GET report-draft returns a draft from confirmed facts only; model-origin facts stay blank; non-owner is denied', async () => {
    const owner = uid('owner');
    const caseId = await seedCase(owner, false);
    const app = buildApi([createReportRoutes()], deps);
    const res = await app.inject({ method: 'GET', url: `/api/v1/cases/${caseId}/report-draft`, headers: await authHeader(owner) });
    expect(res.statusCode).toBe(200);
    const draft = res.json();
    const byName = Object.fromEntries(draft.fields.map((f: { ncrpField: string }) => [f.ncrpField, f]));
    expect(byName["Caller's claimed identity"].value).toBe('Bank fraud desk');
    expect(byName['Central claim or threat']).toMatchObject({ value: 'Account compromised' });
    expect(byName['Requested action'].blank).toBe(true);
    expect(draft.submitted).toBe(false);

    const denied = await app.inject({ method: 'GET', url: `/api/v1/cases/${caseId}/report-draft`, headers: await authHeader(uid('intruder')) });
    expect(denied.statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: `/api/v1/cases/${caseId}/report-draft` })).statusCode).toBe(401);
    await app.close();
  });

  it('GET download returns an attachment HTML draft', async () => {
    const owner = uid('owner');
    const caseId = await seedCase(owner, false);
    const app = buildApi([createReportRoutes()], deps);
    const res = await app.inject({ method: 'GET', url: `/api/v1/cases/${caseId}/report-draft/download`, headers: await authHeader(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.body).toContain('Draft for your review');
    await app.close();
  });

  it('viewing the draft writes nothing: no acknowledgement and no fraud-list entry (no unattended submission)', async () => {
    const owner = uid('owner');
    const caseId = await seedCase(owner, true);
    const app = buildApi([createReportRoutes()], deps);
    await app.inject({ method: 'GET', url: `/api/v1/cases/${caseId}/report-draft`, headers: await authHeader(owner) });
    await app.inject({ method: 'GET', url: `/api/v1/cases/${caseId}/report-draft/download`, headers: await authHeader(owner) });
    const snap = await db.collection('cases').doc(caseId).get();
    expect(snap.get('recoveryAcknowledgement')).toBeUndefined();
    expect(await listFraudEntries(db, owner)).toHaveLength(0);
    await app.close();
  });

  it('authority-report basis: after the user records the 1930 handoff, the number lands on the private list as authority-report', async () => {
    const owner = uid('owner');
    const caseId = await seedCase(owner, true);
    const app = buildApi([createReportRoutes()], deps);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/report-handoff`,
      headers: await authHeader(owner),
      payload: { idempotencyKey: randomUUID(), callerNumber: CALLER },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ handedOff: true, filed: false, fraudList: { basis: 'authority-report', private: true } });
    expect(body.statement).toMatch(/has not filed/i);
    expect(body.statement).toMatch(/cannot confirm/i);
    expect((await db.collection('cases').doc(caseId).get()).get('recoveryAcknowledgement')).toMatchObject({ action: 'helpline-1930', simulated: true });
    expect(await isOnFraudList(db, owner, normalizeNumber(CALLER)!)).toBe(true);
    const entries = await listFraudEntries(db, owner);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ basis: 'authority-report', caseId });
    await app.close();
  });

  it('handoff without a caller number records only the acknowledgement; outside Recover it is rejected and writes nothing', async () => {
    const owner = uid('owner');
    const recovering = await seedCase(owner, true);
    const notRecovering = await seedCase(owner, false);
    const app = buildApi([createReportRoutes()], deps);
    const headers = await authHeader(owner);

    const ok = await app.inject({ method: 'POST', url: `/api/v1/cases/${recovering}/report-handoff`, headers, payload: { idempotencyKey: randomUUID() } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().fraudList).toBeNull();

    const rejected = await app.inject({ method: 'POST', url: `/api/v1/cases/${notRecovering}/report-handoff`, headers, payload: { idempotencyKey: randomUUID(), callerNumber: CALLER } });
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json().error).toBe('NOT_IN_RECOVERY');
    expect(await listFraudEntries(db, owner)).toHaveLength(0);
    await app.close();
  });

  it('an invalid caller number is rejected before anything is written', async () => {
    const owner = uid('owner');
    const caseId = await seedCase(owner, true);
    const app = buildApi([createReportRoutes()], deps);
    const res = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/report-handoff`, headers: await authHeader(owner), payload: { idempotencyKey: randomUUID(), callerNumber: 'abc' } });
    expect(res.statusCode).toBe(400);
    expect((await db.collection('cases').doc(caseId).get()).get('recoveryAcknowledgement')).toBeUndefined();
    await app.close();
  });
});

describe('authority-report precondition stays intact (never bypassed)', () => {
  it('addConfirmedFraud with authority-report and NO recorded 1930 acknowledgement throws REPORT_NOT_RECORDED and writes nothing', async () => {
    const owner = uid('owner');
    const caseId = await seedCase(owner, true);
    await expect(addConfirmedFraud(db, owner, { caseId, normalizedNumber: normalizeNumber(CALLER)!, basis: 'authority-report' })).rejects.toThrow('REPORT_NOT_RECORDED');
    expect(await isOnFraudList(db, owner, normalizeNumber(CALLER)!)).toBe(false);
  });

  it('the fraud-confirmation route still answers 409 REPORT_NOT_RECORDED without the handoff, and 200 after it', async () => {
    const owner = uid('owner');
    const caseId = await seedCase(owner, true);
    const app = buildApi([createScreeningRoutes(), createReportRoutes()], deps);
    const headers = await authHeader(owner);
    const before = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/fraud-confirmation`, headers, payload: { callerNumber: CALLER, basis: 'authority-report' } });
    expect(before.statusCode).toBe(409);
    expect(before.json().error).toBe('REPORT_NOT_RECORDED');

    await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/report-handoff`, headers, payload: { idempotencyKey: randomUUID() } });
    const after = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/fraud-confirmation`, headers, payload: { callerNumber: CALLER, basis: 'authority-report' } });
    expect(after.statusCode).toBe(200);
    expect(after.json().basis).toBe('authority-report');
    await app.close();
  });
});
