import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase } from '../src/case-store.js';
import { acceptInvitation, createInvitation, savePlan } from '../src/plan.js';
import { issuePairingCode } from '../src/ally-pairing.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { createEvidenceRoutes } from '../src/evidence-routes.js';
import { sessionRoutes } from '../src/session-routes.js';
import { createAllyRoutes } from '../src/ally-routes.js';
import { profileRoutes } from '../src/profile-routes.js';
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

const uid = (prefix: string): string => `${prefix}-${randomUUID()}`;

interface Seeded {
  owner: string;
  ally: string;
  caseId: string;
}

async function seed(): Promise<Seeded> {
  const owner = uid('owner');
  const ally = uid('ally');
  await savePlan(db, owner, {
    thresholdMinor: 500_000,
    bankId: 'demo-bank',
    processingConsent: true,
    retentionMode: 'selected-7d',
    allySharingConsent: true,
    exportConsent: false,
  });
  const { code } = await issuePairingCode(db, ally);
  const invitation = await createInvitation(db, owner, code);
  await acceptInvitation(db, invitation.id, ally);
  const created = await createCase(db, owner, 1);
  const ref = db.collection('cases').doc(created.id);
  await ref.update({
    facts: {
      centralClaim: { field: 'centralClaim', value: 'Account compromised', origin: 'model', sourceSegmentIds: ['s1'], uncertainty: 'low' },
      requestedAction: { field: 'requestedAction', value: 'Transfer to a safe account', origin: 'model', sourceSegmentIds: ['s1'], uncertainty: 'low' },
    },
    confirmed: {},
    paymentDraft: { id: 'd1', beneficiaryId: 'safe-new', amountMinor: 5_000_000, newPayee: true, version: 1 },
    paymentState: 'pending',
    segmentIds: ['s1', 's2'],
    reasons: [],
    fullTranscript: 'HIDDEN-TRANSCRIPT full call text',
  });
  await ref.collection('segments').doc('s1').set({ id: 's1', speaker: 'caller', text: 'HIDDEN-TRANSCRIPT one', order: 1 });
  await ref.collection('evidence').doc('e1').set({
    id: 'e1', caseId: created.id, segmentId: 's1', speaker: 'caller', text: 'Transfer 50,000 to safe-new', order: 1, promotedAt: new Date().toISOString(),
  });
  await ref.collection('evidence').doc('e2').set({
    id: 'e2', caseId: created.id, segmentId: 's1', speaker: 'caller', text: 'UNSELECTED-EVIDENCE other excerpt', order: 2, promotedAt: new Date().toISOString(),
  });
  return { owner, ally, caseId: created.id };
}

describe('ally reach routes (DSN-027)', () => {
  const app = () => buildApi([createAllyRoutes(), createEvidenceRoutes(), sessionRoutes, profileRoutes], deps);

  async function call(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, who: string, payload?: unknown) {
    return app().inject({ method, url, headers: await authHeader(who), ...(payload !== undefined ? { payload: payload as object } : {}) });
  }

  async function share(s: Seeded): Promise<void> {
    const preview = (await call('POST', `/api/v1/cases/${s.caseId}/ally-share-preview`, s.owner, {})).json();
    const grant = await call('POST', `/api/v1/cases/${s.caseId}/ally-grant`, s.owner, {
      allyUid: s.ally, expectedCaseVersion: preview.caseVersion, expectedPacketHash: preview.packetHash,
    });
    expect(grant.statusCode).toBe(200);
  }

  const ownerSummaryUrl = (s: Seeded) => `/api/v1/cases/${s.caseId}/ally-whatsapp-summary?allyUid=${s.ally}`;

  it('no grant yet: owner summary, ally summary and contact action are all denied', async () => {
    const s = await seed();
    expect((await call('GET', ownerSummaryUrl(s), s.owner)).statusCode).toBe(403);
    expect((await call('GET', `/api/v1/ally/cases/${s.caseId}/whatsapp-summary`, s.ally)).statusCode).toBe(403);
    expect((await call('POST', `/api/v1/ally/cases/${s.caseId}/contact-caller`, s.ally, { idempotencyKey: randomUUID() })).statusCode).toBe(403);
  });

  it('WhatsApp summary carries ONLY the minimum packet, as a human-opened wa.me link', async () => {
    const s = await seed();
    await share(s);
    const res = await call('GET', ownerSummaryUrl(s), s.owner);
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
    const summary = res.json();
    expect(Object.keys(summary).sort()).toEqual(['caseId', 'expiresAt', 'text', 'url']);
    expect(summary.url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(summary.url.slice('https://wa.me/?text='.length))).toBe(summary.text);
    expect(summary.text).toContain('Account compromised');
    expect(summary.text).toContain('Transfer to a safe account');
    expect(summary.text).toContain('Rs 50,000');
    // The AI gist is included; raw transcript excerpts never are.
    expect(summary.text).toContain('Summary:');
    // Nothing beyond the granted packet: no transcript, no unshared evidence.
    expect(res.body).not.toContain('HIDDEN-TRANSCRIPT');
    expect(res.body).not.toContain('UNSELECTED-EVIDENCE');
    // The ally can fetch the same summary; a non-owner cannot request the owner route.
    const allyRes = await call('GET', `/api/v1/ally/cases/${s.caseId}/whatsapp-summary`, s.ally);
    expect(allyRes.statusCode).toBe(200);
    expect(allyRes.json().text).toBe(summary.text);
    expect((await call('GET', ownerSummaryUrl(s), s.ally)).statusCode).toBe(403);
  });

  it('opens WhatsApp straight to the ally\'s own number once they have set one (owner route only)', async () => {
    const s = await seed();
    await share(s);
    expect((await call('GET', ownerSummaryUrl(s), s.owner)).json().url.startsWith('https://wa.me/?text=')).toBe(true);

    expect((await call('PUT', '/api/v1/profile', s.ally, { displayName: 'Priya', mobile: '98765 43210' })).statusCode).toBe(200);
    const owner = (await call('GET', ownerSummaryUrl(s), s.owner)).json();
    expect(owner.url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    // The ally's own copy is never addressed back to themselves.
    expect((await call('GET', `/api/v1/ally/cases/${s.caseId}/whatsapp-summary`, s.ally)).json().url.startsWith('https://wa.me/?text=')).toBe(true);
  });

  it('contact-caller returns a script, records an advisory response, and grants no fund control or certification', async () => {
    const s = await seed();
    await share(s);
    const res = await call('POST', `/api/v1/ally/cases/${s.caseId}/contact-caller`, s.ally, { idempotencyKey: randomUUID() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ caseId: s.caseId, canControlFunds: false, canCertifyCaller: false });
    expect(body.script).toContain('Account compromised');
    expect(body.script).not.toContain('HIDDEN-TRANSCRIPT');
    expect(body.script).not.toContain('UNSELECTED-EVIDENCE');
    const responses = await db.collection('cases').doc(s.caseId).collection('allyResponses').get();
    expect(responses.docs.map((d) => d.get('kind'))).toEqual(['contact-caller']);
    const caseDoc = (await db.collection('cases').doc(s.caseId).get()).data();
    expect(caseDoc?.paymentState).toBe('pending');
    expect(caseDoc?.phase).toBe('Observe');
    expect((await call('POST', `/api/v1/ally/cases/${s.caseId}/contact-caller`, s.owner, { idempotencyKey: randomUUID() })).statusCode).toBe(403);
    expect((await call('POST', `/api/v1/ally/cases/${s.caseId}/contact-caller`, s.ally, {})).statusCode).toBe(400);
  });

  it('LEAST PRIVILEGE (direct API): an active ally still cannot fetch transcript or unshared evidence, control funds, or certify', async () => {
    const s = await seed();
    await share(s);
    const packet = await call('GET', `/api/v1/ally/cases/${s.caseId}`, s.ally);
    expect(packet.statusCode).toBe(200);
    expect(packet.body).not.toContain('HIDDEN-TRANSCRIPT');
    expect(packet.body).not.toContain('UNSELECTED-EVIDENCE');
    const ev = await call('GET', `/api/v1/cases/${s.caseId}/evidence?ids=e2`, s.ally);
    expect(ev.statusCode).toBe(403);
    expect(ev.body).not.toContain('UNSELECTED-EVIDENCE');
    expect([403, 404]).toContain((await call('GET', `/api/v1/cases/${s.caseId}`, s.ally)).statusCode);
    for (const kind of ['certify-caller', 'approve-payment', 'move-funds']) {
      expect((await call('POST', `/api/v1/ally/cases/${s.caseId}/response`, s.ally, { idempotencyKey: randomUUID(), kind })).statusCode).toBe(400);
    }
    expect((await call('POST', `/api/v1/ally/cases/${s.caseId}/payment/continue`, s.ally, {})).statusCode).toBe(404);
  });

  it('REVOCATION (direct API): the very next ally request is denied - packet, summaries and contact action', async () => {
    const s = await seed();
    await share(s);
    expect((await call('GET', `/api/v1/ally/cases/${s.caseId}`, s.ally)).statusCode).toBe(200);
    expect((await call('GET', ownerSummaryUrl(s), s.owner)).statusCode).toBe(200);
    expect((await call('DELETE', `/api/v1/cases/${s.caseId}/ally-grant?allyUid=${s.ally}`, s.owner)).statusCode).toBe(204);
    expect((await call('GET', `/api/v1/ally/cases/${s.caseId}`, s.ally)).statusCode).toBe(403);
    expect((await call('GET', `/api/v1/ally/cases/${s.caseId}/whatsapp-summary`, s.ally)).statusCode).toBe(403);
    expect((await call('GET', ownerSummaryUrl(s), s.owner)).statusCode).toBe(403);
    const contact = await call('POST', `/api/v1/ally/cases/${s.caseId}/contact-caller`, s.ally, { idempotencyKey: randomUUID() });
    expect(contact.statusCode).toBe(403);
    expect(contact.body).not.toContain('Account compromised');
    const responses = await db.collection('cases').doc(s.caseId).collection('allyResponses').get();
    expect(responses.size).toBe(0);
  });
});
