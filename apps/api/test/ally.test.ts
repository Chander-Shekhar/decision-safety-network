import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase } from '../src/case-store.js';
import { acceptInvitation, createInvitation, revokeInvitation, savePlan } from '../src/plan.js';
import { issuePairingCode } from '../src/ally-pairing.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { createEvidenceRoutes } from '../src/evidence-routes.js';
import { sessionRoutes } from '../src/session-routes.js';
import { createAllyGrant, previewAllyPacket, readAllyPacket, respondAsAlly, revokeGrant } from '../src/ally.js';
import { createAllyRoutes } from '../src/ally-routes.js';
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

const PACKET_KEYS = ['amountMinor', 'caseId', 'claim', 'expiresAt', 'proposedAction', 'selectedEvidence', 'verificationGap'];

interface Seeded {
  owner: string;
  ally: string;
  caseId: string;
  invitationId: string;
}

/** Owner plan with ally-sharing consent, a nominated-but-NOT-yet-accepted ally, and one pending case with a transcript. */
async function seed(opts: { consent?: boolean; accept?: boolean } = {}): Promise<Seeded> {
  const owner = uid('owner');
  const ally = uid('ally');
  await savePlan(db, owner, {
    thresholdMinor: 500_000,
    bankId: 'demo-bank',
    processingConsent: true,
    retentionMode: 'selected-7d',
    allySharingConsent: opts.consent ?? true,
    exportConsent: false,
  });
  const { code } = await issuePairingCode(db, ally);
  const invitation = await createInvitation(db, owner, code);
  if (opts.accept !== false) {
    await acceptInvitation(db, invitation.id, ally);
  }
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
    fullTranscript: 'SECRET-TRANSCRIPT full call text',
  });
  await ref.collection('segments').doc('s1').set({ id: 's1', speaker: 'caller', text: 'SECRET-TRANSCRIPT one', order: 1 });
  await ref.collection('segments').doc('s2').set({ id: 's2', speaker: 'caller', text: 'SECRET-TRANSCRIPT two', order: 2 });
  await ref.collection('evidence').doc('e1').set({
    id: 'e1', caseId: created.id, segmentId: 's1', speaker: 'caller', text: 'Transfer ₹50,000 to safe-new', order: 1, promotedAt: new Date().toISOString(),
  });
  await ref.collection('evidence').doc('e2').set({
    id: 'e2', caseId: created.id, segmentId: 's2', speaker: 'caller', text: 'UNSELECTED-EVIDENCE other excerpt', order: 2, promotedAt: new Date().toISOString(),
  });
  return { owner, ally, caseId: created.id, invitationId: invitation.id };
}

async function share(s: Seeded): Promise<{ caseVersion: number; packetHash: string }> {
  const preview = await previewAllyPacket(db, s.owner, s.caseId, { selectedEvidenceIds: ['e1'] });
  await createAllyGrant(db, s.owner, s.caseId, {
    allyUid: s.ally,
    selectedEvidenceIds: ['e1'],
    expectedCaseVersion: preview.caseVersion,
    expectedPacketHash: preview.packetHash,
  });
  return preview;
}

/** Simulates a packet-affecting owner edit the way the real correct/draft routes do: change content and bump the version. */
async function bumpCase(caseId: string, patch: Record<string, unknown>): Promise<void> {
  const ref = db.collection('cases').doc(caseId);
  const snap = await ref.get();
  await ref.update({ ...patch, version: (snap.get('version') as number) + 1 });
}

describe('ally packet (functions)', () => {
  it('nominated-but-unaccepted ally cannot read; preview and Not now grant nothing', async () => {
    const s = await seed({ accept: false });
    await expect(readAllyPacket(db, s.ally, s.caseId)).rejects.toThrow('FORBIDDEN');
    await acceptInvitation(db, s.invitationId, s.ally);
    const preview = await previewAllyPacket(db, s.owner, s.caseId, { selectedEvidenceIds: ['e1'] });
    expect(preview.packetContent.selectedEvidence).toEqual([{ id: 'e1', excerpt: 'Transfer ₹50,000 to safe-new' }]);
    // merely opening a preview (and then "Not now": no further call) discloses nothing
    await expect(readAllyPacket(db, s.ally, s.caseId)).rejects.toThrow('FORBIDDEN');
    const grants = await db.collection('cases').doc(s.caseId).collection('allyGrants').get();
    expect(grants.empty).toBe(true);
  });

  it('a non-owner cannot preview', async () => {
    const s = await seed();
    await expect(previewAllyPacket(db, s.ally, s.caseId, { selectedEvidenceIds: ['e1'] })).rejects.toThrow('FORBIDDEN');
  });

  it('explicit Share freezes exactly the previewed packet; key set is exact; no transcript', async () => {
    const s = await seed();
    const preview = await previewAllyPacket(db, s.owner, s.caseId, { selectedEvidenceIds: ['e1'] });
    expect(preview.packetContent).toMatchObject({ claim: 'Account compromised', proposedAction: 'Transfer to a safe account', amountMinor: 5_000_000 });
    await createAllyGrant(db, s.owner, s.caseId, {
      allyUid: s.ally,
      selectedEvidenceIds: ['e1'],
      expectedCaseVersion: preview.caseVersion,
      expectedPacketHash: preview.packetHash,
    });
    const packet = await readAllyPacket(db, s.ally, s.caseId);
    expect(packet).toMatchObject(preview.packetContent);
    expect(Object.keys(packet).sort()).toEqual([...PACKET_KEYS].sort());
    const json = JSON.stringify(packet);
    expect(json).not.toContain('fullTranscript');
    expect(json).not.toContain('SECRET-TRANSCRIPT');
    expect(json).not.toContain('UNSELECTED-EVIDENCE');
  });

  it('a stale preview (version or hash) cannot create a grant', async () => {
    const s = await seed();
    const preview = await previewAllyPacket(db, s.owner, s.caseId, { selectedEvidenceIds: ['e1'] });
    await bumpCase(s.caseId, { paymentDraft: { id: 'd2', beneficiaryId: 'safe-new', amountMinor: 9_000_000, newPayee: true, version: 2 } });
    await expect(
      createAllyGrant(db, s.owner, s.caseId, { allyUid: s.ally, selectedEvidenceIds: ['e1'], expectedCaseVersion: preview.caseVersion, expectedPacketHash: preview.packetHash }),
    ).rejects.toThrow('STALE_PREVIEW');
    const fresh = await previewAllyPacket(db, s.owner, s.caseId, { selectedEvidenceIds: ['e1'] });
    await expect(
      createAllyGrant(db, s.owner, s.caseId, { allyUid: s.ally, selectedEvidenceIds: ['e1'], expectedCaseVersion: fresh.caseVersion, expectedPacketHash: preview.packetHash }),
    ).rejects.toThrow('STALE_PREVIEW');
    await expect(readAllyPacket(db, s.ally, s.caseId)).rejects.toThrow('FORBIDDEN');
  });

  it('Share for a different evidence selection than previewed is rejected', async () => {
    const s = await seed();
    const preview = await previewAllyPacket(db, s.owner, s.caseId, { selectedEvidenceIds: ['e1'] });
    await expect(
      createAllyGrant(db, s.owner, s.caseId, { allyUid: s.ally, selectedEvidenceIds: ['e1', 'e2'], expectedCaseVersion: preview.caseVersion, expectedPacketHash: preview.packetHash }),
    ).rejects.toThrow('STALE_PREVIEW');
  });

  it('unknown evidence ids are rejected at preview', async () => {
    const s = await seed();
    await expect(previewAllyPacket(db, s.owner, s.caseId, { selectedEvidenceIds: ['nope'] })).rejects.toThrow('UNKNOWN_EVIDENCE');
  });

  it.each([
    ['a correction', { confirmed: { centralClaim: { field: 'centralClaim', value: 'Something else', origin: 'user-corrected', sourceSegmentIds: [], uncertainty: 'low' } } }],
    ['a draft edit', { paymentDraft: { id: 'd2', beneficiaryId: 'safe-new', amountMinor: 1, newPayee: true, version: 2 } }],
  ])('%s after Share invalidates access (no silent widening)', async (_name, patch) => {
    const s = await seed();
    await share(s);
    await expect(readAllyPacket(db, s.ally, s.caseId)).resolves.toBeDefined();
    await bumpCase(s.caseId, patch);
    await expect(readAllyPacket(db, s.ally, s.caseId)).rejects.toThrow('STALE_GRANT');
    // re-preview + re-share restores access to the NEW content only
    await share(s);
    const current = await previewAllyPacket(db, s.owner, s.caseId, { selectedEvidenceIds: ['e1'] });
    expect(await readAllyPacket(db, s.ally, s.caseId)).toMatchObject(current.packetContent);
  });

  it('an evidence change after Share invalidates access', async () => {
    const s = await seed();
    await share(s);
    await db.collection('cases').doc(s.caseId).collection('evidence').doc('e1').update({ text: 'edited excerpt' });
    await expect(readAllyPacket(db, s.ally, s.caseId)).rejects.toThrow('STALE_GRANT');
  });

  it('active ally cannot read another case', async () => {
    const s = await seed();
    await share(s);
    const other = await createCase(db, s.owner, 1);
    await expect(readAllyPacket(db, s.ally, other.id)).rejects.toThrow('FORBIDDEN');
    await expect(readAllyPacket(db, uid('stranger'), s.caseId)).rejects.toThrow('FORBIDDEN');
  });

  it('revoked relationship blocks the next request', async () => {
    const s = await seed();
    await share(s);
    await revokeInvitation(db, s.invitationId, s.owner);
    await expect(readAllyPacket(db, s.ally, s.caseId)).rejects.toThrow('FORBIDDEN');
  });

  it('revoked sharing consent blocks the next request', async () => {
    const s = await seed();
    await share(s);
    await db.collection('plans').doc(s.owner).update({ allySharingConsent: false });
    await expect(readAllyPacket(db, s.ally, s.caseId)).rejects.toThrow('FORBIDDEN');
  });

  it('revokeGrant blocks the next request and purges the snapshot', async () => {
    const s = await seed();
    await share(s);
    await revokeGrant(db, s.owner, s.caseId, s.ally);
    await expect(readAllyPacket(db, s.ally, s.caseId)).rejects.toThrow('FORBIDDEN');
    const grant = (await db.collection('cases').doc(s.caseId).collection('allyGrants').doc(s.ally).get()).data();
    expect(grant?.revokedAt).toBeTruthy();
    expect(JSON.stringify(grant)).not.toContain('Account compromised');
    expect(JSON.stringify(grant)).not.toContain('Transfer ₹50,000');
  });

  it('only the owner can revoke a grant', async () => {
    const s = await seed();
    await share(s);
    await expect(revokeGrant(db, s.ally, s.caseId, s.ally)).rejects.toThrow('FORBIDDEN');
    await expect(readAllyPacket(db, s.ally, s.caseId)).resolves.toBeDefined();
  });

  it('an expired grant blocks reads', async () => {
    const s = await seed();
    await share(s);
    const later = () => new Date(Date.now() + 365 * 24 * 3600 * 1000);
    await expect(readAllyPacket(db, s.ally, s.caseId, later)).rejects.toThrow('FORBIDDEN');
  });

  it('cannot grant without consent, without acceptance, or to a revoked relationship', async () => {
    const noConsent = await seed({ consent: false });
    const p1 = await previewAllyPacket(db, noConsent.owner, noConsent.caseId, { selectedEvidenceIds: ['e1'] });
    await expect(
      createAllyGrant(db, noConsent.owner, noConsent.caseId, { allyUid: noConsent.ally, selectedEvidenceIds: ['e1'], expectedCaseVersion: p1.caseVersion, expectedPacketHash: p1.packetHash }),
    ).rejects.toThrow('FORBIDDEN');

    const unaccepted = await seed({ accept: false });
    const p2 = await previewAllyPacket(db, unaccepted.owner, unaccepted.caseId, { selectedEvidenceIds: ['e1'] });
    await expect(
      createAllyGrant(db, unaccepted.owner, unaccepted.caseId, { allyUid: unaccepted.ally, selectedEvidenceIds: ['e1'], expectedCaseVersion: p2.caseVersion, expectedPacketHash: p2.packetHash }),
    ).rejects.toThrow('FORBIDDEN');

    const declined = await seed();
    await revokeInvitation(db, declined.invitationId, declined.owner);
    const p3 = await previewAllyPacket(db, declined.owner, declined.caseId, { selectedEvidenceIds: ['e1'] });
    await expect(
      createAllyGrant(db, declined.owner, declined.caseId, { allyUid: declined.ally, selectedEvidenceIds: ['e1'], expectedCaseVersion: p3.caseVersion, expectedPacketHash: p3.packetHash }),
    ).rejects.toThrow('FORBIDDEN');

    const stranger = await seed();
    const p4 = await previewAllyPacket(db, stranger.owner, stranger.caseId, { selectedEvidenceIds: ['e1'] });
    await expect(
      createAllyGrant(db, stranger.owner, stranger.caseId, { allyUid: uid('other'), selectedEvidenceIds: ['e1'], expectedCaseVersion: p4.caseVersion, expectedPacketHash: p4.packetHash }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('ally responses persist without touching the case, payment, or verification', async () => {
    const s = await seed();
    await share(s);
    const before = (await db.collection('cases').doc(s.caseId).get()).data();
    await respondAsAlly(db, s.ally, s.caseId, { idempotencyKey: randomUUID(), kind: 'contact-request' });
    await respondAsAlly(db, s.ally, s.caseId, { idempotencyKey: randomUUID(), kind: 'pause-recommendation' });
    await respondAsAlly(db, s.ally, s.caseId, { idempotencyKey: randomUUID(), kind: 'checked-source', source: 'Called the number on my own bank card' });
    const after = (await db.collection('cases').doc(s.caseId).get()).data();
    expect(after).toEqual(before);
    const stored = await db.collection('cases').doc(s.caseId).collection('allyResponses').get();
    expect(stored.docs.map((d) => d.get('kind')).sort()).toEqual(['checked-source', 'contact-request', 'pause-recommendation']);
  });

  it('ally responses are idempotent, and rejected for forbidden/stale/revoked/unsupported', async () => {
    const s = await seed();
    await share(s);
    const key = randomUUID();
    await respondAsAlly(db, s.ally, s.caseId, { idempotencyKey: key, kind: 'contact-request' });
    await respondAsAlly(db, s.ally, s.caseId, { idempotencyKey: key, kind: 'contact-request' });
    await expect(respondAsAlly(db, s.ally, s.caseId, { idempotencyKey: key, kind: 'pause-recommendation' })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    expect((await db.collection('cases').doc(s.caseId).collection('allyResponses').get()).size).toBe(1);
    await expect(respondAsAlly(db, s.ally, s.caseId, { idempotencyKey: randomUUID(), kind: 'certify-caller' } as never)).rejects.toThrow('INVALID_RESPONSE');
    await expect(respondAsAlly(db, s.ally, s.caseId, { idempotencyKey: randomUUID(), kind: 'checked-source', source: '' })).rejects.toThrow('INVALID_RESPONSE');
    await expect(respondAsAlly(db, uid('stranger'), s.caseId, { idempotencyKey: randomUUID(), kind: 'contact-request' })).rejects.toThrow('FORBIDDEN');
    await bumpCase(s.caseId, { paymentDraft: { id: 'd9', beneficiaryId: 'x', amountMinor: 2, newPayee: true, version: 3 } });
    await expect(respondAsAlly(db, s.ally, s.caseId, { idempotencyKey: randomUUID(), kind: 'contact-request' })).rejects.toThrow('STALE_GRANT');
    await revokeGrant(db, s.owner, s.caseId, s.ally);
    await expect(respondAsAlly(db, s.ally, s.caseId, { idempotencyKey: randomUUID(), kind: 'contact-request' })).rejects.toThrow('FORBIDDEN');
  });
});

describe('ally routes', () => {
  const app = () => buildApi([createAllyRoutes(), createEvidenceRoutes(), sessionRoutes], deps);

  async function call(method: 'GET' | 'POST' | 'DELETE', url: string, who: string, payload?: unknown) {
    const a = app();
    return a.inject({ method, url, headers: await authHeader(who), ...(payload !== undefined ? { payload: payload as object } : {}) });
  }

  async function routeShare(s: Seeded) {
    const preview = await call('POST', `/api/v1/cases/${s.caseId}/ally-share-preview`, s.owner, { selectedEvidenceIds: ['e1'] });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers['cache-control']).toContain('no-store');
    const body = preview.json();
    const grant = await call('POST', `/api/v1/cases/${s.caseId}/ally-grant`, s.owner, {
      allyUid: s.ally,
      selectedEvidenceIds: ['e1'],
      expectedCaseVersion: body.caseVersion,
      expectedPacketHash: body.packetHash,
    });
    return { preview: body, grant };
  }

  it('requires authentication', async () => {
    const s = await seed();
    const res = await app().inject({ method: 'GET', url: `/api/v1/ally/cases/${s.caseId}` });
    expect(res.statusCode).toBe(401);
  });

  it('preview is owner-only, no-store, and discloses nothing to the ally', async () => {
    const s = await seed();
    expect((await call('POST', `/api/v1/cases/${s.caseId}/ally-share-preview`, s.ally, { selectedEvidenceIds: ['e1'] })).statusCode).toBe(403);
    const ok = await call('POST', `/api/v1/cases/${s.caseId}/ally-share-preview`, s.owner, { selectedEvidenceIds: ['e1'] });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['cache-control']).toContain('no-store');
    expect((await call('GET', `/api/v1/ally/cases/${s.caseId}`, s.ally)).statusCode).toBe(403);
    expect((await call('POST', `/api/v1/cases/${s.caseId}/ally-share-preview`, s.owner, { selectedEvidenceIds: [] })).statusCode).toBe(400);
    expect((await call('POST', `/api/v1/cases/${s.caseId}/ally-share-preview`, s.owner, { selectedEvidenceIds: ['nope'] })).statusCode).toBe(400);
  });

  it('share then ally read returns exactly the previewed packet; no-store; exact keys', async () => {
    const s = await seed();
    const { preview, grant } = await routeShare(s);
    expect(grant.statusCode).toBe(200);
    expect(JSON.stringify(grant.json())).not.toContain('Account compromised');
    const res = await call('GET', `/api/v1/ally/cases/${s.caseId}`, s.ally);
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
    const packet = res.json();
    expect(packet).toMatchObject(preview.packetContent);
    expect(Object.keys(packet).sort()).toEqual([...PACKET_KEYS].sort());
    expect(res.body).not.toContain('fullTranscript');
    expect(res.body).not.toContain('SECRET-TRANSCRIPT');
  });

  it('stale preview version/hash returns 409', async () => {
    const s = await seed();
    const preview = (await call('POST', `/api/v1/cases/${s.caseId}/ally-share-preview`, s.owner, { selectedEvidenceIds: ['e1'] })).json();
    await bumpCase(s.caseId, { paymentDraft: { id: 'd2', beneficiaryId: 'safe-new', amountMinor: 7, newPayee: true, version: 2 } });
    const res = await call('POST', `/api/v1/cases/${s.caseId}/ally-grant`, s.owner, {
      allyUid: s.ally, selectedEvidenceIds: ['e1'], expectedCaseVersion: preview.caseVersion, expectedPacketHash: preview.packetHash,
    });
    expect(res.statusCode).toBe(409);
    expect((await call('GET', `/api/v1/ally/cases/${s.caseId}`, s.ally)).statusCode).toBe(403);
  });

  it('non-owner cannot grant; grant body is validated', async () => {
    const s = await seed();
    const preview = (await call('POST', `/api/v1/cases/${s.caseId}/ally-share-preview`, s.owner, { selectedEvidenceIds: ['e1'] })).json();
    const forged = await call('POST', `/api/v1/cases/${s.caseId}/ally-grant`, s.ally, {
      allyUid: s.ally, selectedEvidenceIds: ['e1'], expectedCaseVersion: preview.caseVersion, expectedPacketHash: preview.packetHash,
    });
    expect(forged.statusCode).toBe(403);
    expect((await call('POST', `/api/v1/cases/${s.caseId}/ally-grant`, s.owner, { allyUid: s.ally })).statusCode).toBe(400);
  });

  it('denies another case ID, revoked consent, post-share mutation, and revoke on the next request', async () => {
    const s = await seed();
    await routeShare(s);
    const other = await createCase(db, s.owner, 1);
    expect((await call('GET', `/api/v1/ally/cases/${other.id}`, s.ally)).statusCode).toBe(403);

    await bumpCase(s.caseId, { paymentDraft: { id: 'd3', beneficiaryId: 'safe-new', amountMinor: 3, newPayee: true, version: 3 } });
    const stale = await call('GET', `/api/v1/ally/cases/${s.caseId}`, s.ally);
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ error: 'STALE_GRANT' });

    const s2 = await seed();
    await routeShare(s2);
    expect((await call('GET', `/api/v1/ally/cases/${s2.caseId}`, s2.ally)).statusCode).toBe(200);
    await db.collection('plans').doc(s2.owner).update({ allySharingConsent: false });
    expect((await call('GET', `/api/v1/ally/cases/${s2.caseId}`, s2.ally)).statusCode).toBe(403);

    const s3 = await seed();
    await routeShare(s3);
    expect((await call('GET', `/api/v1/ally/cases/${s3.caseId}`, s3.ally)).statusCode).toBe(200);
    expect((await call('DELETE', `/api/v1/cases/${s3.caseId}/ally-grant?allyUid=${s3.ally}`, s3.ally)).statusCode).toBe(403);
    expect((await call('DELETE', `/api/v1/cases/${s3.caseId}/ally-grant?allyUid=${s3.ally}`, s3.owner)).statusCode).toBe(204);
    expect((await call('GET', `/api/v1/ally/cases/${s3.caseId}`, s3.ally)).statusCode).toBe(403);
  });

  it('an active ally cannot reach owner-only transcript or evidence URLs', async () => {
    const s = await seed();
    await routeShare(s);
    const ev = await call('GET', `/api/v1/cases/${s.caseId}/evidence?ids=e2`, s.ally);
    expect(ev.statusCode).toBe(403);
    expect(ev.body).not.toContain('UNSELECTED-EVIDENCE');
    const owned = await call('GET', `/api/v1/cases/${s.caseId}`, s.ally);
    expect([403, 404]).toContain(owned.statusCode);
    const seg = await call('POST', `/api/v1/cases/${s.caseId}/segments`, s.ally, {});
    expect([400, 403, 404]).toContain(seg.statusCode);
    expect(seg.body).not.toContain('SECRET-TRANSCRIPT');
  });

  it('ally response route persists responses and refuses payment / certification commands', async () => {
    const s = await seed();
    await routeShare(s);
    const ok = await call('POST', `/api/v1/ally/cases/${s.caseId}/response`, s.ally, { idempotencyKey: randomUUID(), kind: 'pause-recommendation' });
    expect(ok.statusCode).toBe(204);
    const checked = await call('POST', `/api/v1/ally/cases/${s.caseId}/response`, s.ally, { idempotencyKey: randomUUID(), kind: 'checked-source', source: 'Bank branch visit' });
    expect(checked.statusCode).toBe(204);
    expect((await call('POST', `/api/v1/ally/cases/${s.caseId}/response`, s.ally, { idempotencyKey: randomUUID(), kind: 'certify-caller' })).statusCode).toBe(400);
    expect((await call('POST', `/api/v1/ally/cases/${s.caseId}/response`, s.ally, { idempotencyKey: randomUUID(), kind: 'approve-payment' })).statusCode).toBe(400);
    expect((await call('POST', `/api/v1/ally/cases/${s.caseId}/response`, s.ally, { kind: 'contact-request' })).statusCode).toBe(400);
    expect((await call('POST', `/api/v1/ally/cases/${s.caseId}/response`, s.owner, { idempotencyKey: randomUUID(), kind: 'contact-request' })).statusCode).toBe(403);
    const caseDoc = (await db.collection('cases').doc(s.caseId).get()).data();
    expect(caseDoc?.paymentState).toBe('pending');
    expect(caseDoc?.phase).toBe('Observe');
    // no payment or verification route is exposed to the ally surface
    expect((await call('POST', `/api/v1/ally/cases/${s.caseId}/payment/continue`, s.ally, {})).statusCode).toBe(404);
  });
});
