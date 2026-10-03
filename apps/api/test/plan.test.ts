import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createPlan } from '../../../packages/contracts/src/plan.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import {
  acceptInvitation,
  createInvitation,
  hasAcceptedRelationship,
  revokeInvitation,
  savePlan,
} from '../src/plan.js';
import { issuePairingCode } from '../src/ally-pairing.js';
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

function uid(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

async function nominate(ownerUid: string, allyUid: string): Promise<string> {
  const { code } = await issuePairingCode(db, allyUid);
  const invitation = await createInvitation(db, ownerUid, code);
  return invitation.id;
}

describe('createPlan', () => {
  it('defaults retentionMode to facts-24h', () => {
    expect(createPlan({ thresholdMinor: 500000, bankId: 'demo-bank' }).retentionMode).toBe('facts-24h');
  });

  it('keeps all four consents separate and defaulted to false', () => {
    const plan = createPlan({ thresholdMinor: 500000, bankId: 'demo-bank' });
    expect(plan.processingConsent).toBe(false);
    expect(plan.allySharingConsent).toBe(false);
    expect(plan.exportConsent).toBe(false);
    const partiallyGranted = createPlan({
      thresholdMinor: 500000,
      bankId: 'demo-bank',
      processingConsent: true,
      allySharingConsent: false,
      exportConsent: true,
    });
    expect(partiallyGranted.processingConsent).toBe(true);
    expect(partiallyGranted.allySharingConsent).toBe(false);
    expect(partiallyGranted.exportConsent).toBe(true);
  });
});

describe('savePlan', () => {
  it('persists a plan document the case-store foundation can read a version from', async () => {
    const ownerUid = uid('owner');
    const saved = await savePlan(db, ownerUid, {
      thresholdMinor: 500000,
      bankId: 'demo-bank',
      processingConsent: true,
      retentionMode: 'facts-24h',
      allySharingConsent: true,
      exportConsent: true,
    });
    expect(saved.version).toBe(1);
    const doc = await db.collection('plans').doc(ownerUid).get();
    expect(doc.get('version')).toBe(1);
  });

  it('increments version on repeat saves without clobbering an existing ally nomination', async () => {
    const ownerUid = uid('owner');
    const allyUid = uid('ally');
    await savePlan(db, ownerUid, {
      thresholdMinor: 500000,
      bankId: 'demo-bank',
      processingConsent: true,
      retentionMode: 'facts-24h',
      allySharingConsent: true,
      exportConsent: true,
    });
    await nominate(ownerUid, allyUid);
    const resaved = await savePlan(db, ownerUid, {
      thresholdMinor: 700000,
      bankId: 'demo-bank',
      processingConsent: true,
      retentionMode: 'selected-7d',
      allySharingConsent: true,
      exportConsent: false,
    });
    expect(resaved.version).toBe(2);
    expect(resaved.nominatedAllyUid).toBe(allyUid);
  });
});

describe('detail-free invitation and pairing code lifecycle', () => {
  it('issues a pairing code bound to the requesting ally and rejects self-nomination', async () => {
    const ownerUid = uid('owner');
    await savePlan(db, ownerUid, {
      thresholdMinor: 500000,
      bankId: 'demo-bank',
      processingConsent: true,
      retentionMode: 'facts-24h',
      allySharingConsent: true,
      exportConsent: true,
    });
    const { code } = await issuePairingCode(db, ownerUid);
    await expect(createInvitation(db, ownerUid, code)).rejects.toThrow('SELF_NOMINATION');
  });

  it('rejects an unknown pairing code', async () => {
    const ownerUid = uid('owner');
    await savePlan(db, ownerUid, {
      thresholdMinor: 500000,
      bankId: 'demo-bank',
      processingConsent: true,
      retentionMode: 'facts-24h',
      allySharingConsent: true,
      exportConsent: true,
    });
    await expect(createInvitation(db, ownerUid, 'does-not-exist')).rejects.toThrow('PAIRING_CODE_NOT_FOUND');
  });

  it('rejects an expired pairing code', async () => {
    const ownerUid = uid('owner');
    const allyUid = uid('ally');
    await savePlan(db, ownerUid, {
      thresholdMinor: 500000,
      bankId: 'demo-bank',
      processingConsent: true,
      retentionMode: 'facts-24h',
      allySharingConsent: true,
      exportConsent: true,
    });
    const { code } = await issuePairingCode(db, allyUid);
    const past = new Date(Date.now() - 60_000).toISOString();
    await db.collection('allyPairingCodes').doc(code).update({ expiresAt: past });
    await expect(createInvitation(db, ownerUid, code)).rejects.toThrow('PAIRING_CODE_EXPIRED');
  });

  it('rejects a reused (already-consumed) pairing code', async () => {
    const ownerUid = uid('owner');
    const otherOwnerUid = uid('owner2');
    const allyUid = uid('ally');
    for (const o of [ownerUid, otherOwnerUid]) {
      await savePlan(db, o, {
        thresholdMinor: 500000,
        bankId: 'demo-bank',
        processingConsent: true,
        retentionMode: 'facts-24h',
        allySharingConsent: true,
        exportConsent: true,
      });
    }
    const { code } = await issuePairingCode(db, allyUid);
    await createInvitation(db, ownerUid, code);
    await expect(createInvitation(db, otherOwnerUid, code)).rejects.toThrow('PAIRING_CODE_CONSUMED');
  });

  it('creates an invitation that exposes no case data', async () => {
    const ownerUid = uid('owner');
    const allyUid = uid('ally');
    await savePlan(db, ownerUid, {
      thresholdMinor: 500000,
      bankId: 'demo-bank',
      processingConsent: true,
      retentionMode: 'facts-24h',
      allySharingConsent: true,
      exportConsent: true,
    });
    const { code } = await issuePairingCode(db, allyUid);
    const invitation = await createInvitation(db, ownerUid, code);
    expect(invitation).toEqual(expect.objectContaining({ ownerUid, allyUid }));
    expect(JSON.stringify(invitation)).not.toMatch(/claim|payee|transcript/);
  });
});

describe('hasAcceptedRelationship', () => {
  it('is false until accepted, true after accept, and false again after revoke on the next call', async () => {
    const ownerUid = uid('u');
    const allyUid = uid('a');
    await savePlan(db, ownerUid, {
      thresholdMinor: 500000,
      bankId: 'demo-bank',
      processingConsent: true,
      retentionMode: 'facts-24h',
      allySharingConsent: true,
      exportConsent: true,
    });
    const invitationId = await nominate(ownerUid, allyUid);

    expect(await hasAcceptedRelationship(db, ownerUid, allyUid)).toBe(false);
    await acceptInvitation(db, invitationId, allyUid);
    expect(await hasAcceptedRelationship(db, ownerUid, allyUid)).toBe(true);
    await revokeInvitation(db, invitationId, ownerUid);
    expect(await hasAcceptedRelationship(db, ownerUid, allyUid)).toBe(false);
  });

  it('only the nominated ally can accept; another authenticated user cannot', async () => {
    const ownerUid = uid('owner');
    const allyUid = uid('ally');
    const impostorUid = uid('impostor');
    await savePlan(db, ownerUid, {
      thresholdMinor: 500000,
      bankId: 'demo-bank',
      processingConsent: true,
      retentionMode: 'facts-24h',
      allySharingConsent: true,
      exportConsent: true,
    });
    const invitationId = await nominate(ownerUid, allyUid);
    await expect(acceptInvitation(db, invitationId, impostorUid)).rejects.toThrow('FORBIDDEN');
    expect(await hasAcceptedRelationship(db, ownerUid, allyUid)).toBe(false);
  });

  it('only the owner can revoke; another authenticated user cannot', async () => {
    const ownerUid = uid('owner');
    const allyUid = uid('ally');
    const impostorUid = uid('impostor');
    await savePlan(db, ownerUid, {
      thresholdMinor: 500000,
      bankId: 'demo-bank',
      processingConsent: true,
      retentionMode: 'facts-24h',
      allySharingConsent: true,
      exportConsent: true,
    });
    const invitationId = await nominate(ownerUid, allyUid);
    await acceptInvitation(db, invitationId, allyUid);
    await expect(revokeInvitation(db, invitationId, impostorUid)).rejects.toThrow('FORBIDDEN');
    expect(await hasAcceptedRelationship(db, ownerUid, allyUid)).toBe(true);
  });
});

describe('authenticated plan/ally-pairing HTTP routes', () => {
  it('PUT /api/v1/plan saves the four separate consents, threshold, and Demo Bank route', async () => {
    const ownerUid = uid('owner');
    const app = buildApi([planRoutes], deps);
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/plan',
      headers: await authHeader(ownerUid),
      payload: {
        thresholdMinor: 500000,
        bankId: 'demo-bank',
        processingConsent: true,
        retentionMode: 'facts-24h',
        allySharingConsent: false,
        exportConsent: true,
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { thresholdMinor: number; bankId: string; retentionMode: string };
    expect(body.thresholdMinor).toBe(500000);
    expect(body.bankId).toBe('demo-bank');
    expect(body.retentionMode).toBe('facts-24h');
  });

  it('PUT /api/v1/plan rejects an unknown bank id', async () => {
    const ownerUid = uid('owner');
    const app = buildApi([planRoutes], deps);
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/plan',
      headers: await authHeader(ownerUid),
      payload: {
        thresholdMinor: 500000,
        bankId: 'real-bank',
        processingConsent: true,
        retentionMode: 'facts-24h',
        allySharingConsent: false,
        exportConsent: true,
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it('PUT /api/v1/plan rejects an invalid threshold', async () => {
    const ownerUid = uid('owner');
    const app = buildApi([planRoutes], deps);
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/plan',
      headers: await authHeader(ownerUid),
      payload: {
        thresholdMinor: -1,
        bankId: 'demo-bank',
        processingConsent: true,
        retentionMode: 'facts-24h',
        allySharingConsent: false,
        exportConsent: true,
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it('PUT /api/v1/plan denies an unauthenticated request', async () => {
    const app = buildApi([planRoutes], deps);
    const response = await app.inject({ method: 'PUT', url: '/api/v1/plan', payload: {} });
    expect(response.statusCode).toBe(401);
  });

  it('full HTTP pairing/invitation flow: issue code, nominate, accept, read packet-free invitation, revoke', async () => {
    const ownerUid = uid('owner');
    const allyUid = uid('ally');
    const app = buildApi([planRoutes], deps);

    await app.inject({
      method: 'PUT',
      url: '/api/v1/plan',
      headers: await authHeader(ownerUid),
      payload: {
        thresholdMinor: 500000,
        bankId: 'demo-bank',
        processingConsent: true,
        retentionMode: 'facts-24h',
        allySharingConsent: true,
        exportConsent: true,
      },
    });

    const codeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/ally-pairing-code',
      headers: await authHeader(allyUid),
    });
    expect(codeResponse.statusCode).toBe(200);
    const { code } = codeResponse.json() as { code: string; expiresAt: string };

    const invitationResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/ally-invitations',
      headers: await authHeader(ownerUid),
      payload: { pairingCode: code },
    });
    expect(invitationResponse.statusCode).toBe(200);
    const invitation = invitationResponse.json() as { id: string; ownerUid: string; allyUid: string };
    expect(invitation.ownerUid).toBe(ownerUid);
    expect(invitation.allyUid).toBe(allyUid);
    expect(JSON.stringify(invitation)).not.toMatch(/claim|payee|transcript/);

    expect(await hasAcceptedRelationship(db, ownerUid, allyUid)).toBe(false);

    const acceptResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/ally-invitations/${invitation.id}/accept`,
      headers: await authHeader(allyUid),
    });
    expect(acceptResponse.statusCode).toBe(200);
    expect(await hasAcceptedRelationship(db, ownerUid, allyUid)).toBe(true);

    const revokeResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/ally-invitations/${invitation.id}/revoke`,
      headers: await authHeader(ownerUid),
    });
    expect(revokeResponse.statusCode).toBe(200);
    expect(await hasAcceptedRelationship(db, ownerUid, allyUid)).toBe(false);
  });

  it('rejects a reused pairing code over HTTP', async () => {
    const ownerUid = uid('owner');
    const otherOwnerUid = uid('owner2');
    const allyUid = uid('ally');
    const app = buildApi([planRoutes], deps);
    for (const o of [ownerUid, otherOwnerUid]) {
      await app.inject({
        method: 'PUT',
        url: '/api/v1/plan',
        headers: await authHeader(o),
        payload: {
          thresholdMinor: 500000,
          bankId: 'demo-bank',
          processingConsent: true,
          retentionMode: 'facts-24h',
          allySharingConsent: true,
          exportConsent: true,
        },
      });
    }
    const codeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/ally-pairing-code',
      headers: await authHeader(allyUid),
    });
    const { code } = codeResponse.json() as { code: string };

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/ally-invitations',
      headers: await authHeader(ownerUid),
      payload: { pairingCode: code },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/ally-invitations',
      headers: await authHeader(otherOwnerUid),
      payload: { pairingCode: code },
    });
    expect(second.statusCode).toBe(400);
  });

  it('rejects self-nomination over HTTP', async () => {
    const ownerUid = uid('owner');
    const app = buildApi([planRoutes], deps);
    await app.inject({
      method: 'PUT',
      url: '/api/v1/plan',
      headers: await authHeader(ownerUid),
      payload: {
        thresholdMinor: 500000,
        bankId: 'demo-bank',
        processingConsent: true,
        retentionMode: 'facts-24h',
        allySharingConsent: true,
        exportConsent: true,
      },
    });
    const codeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/ally-pairing-code',
      headers: await authHeader(ownerUid),
    });
    const { code } = codeResponse.json() as { code: string };
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ally-invitations',
      headers: await authHeader(ownerUid),
      payload: { pairingCode: code },
    });
    expect(response.statusCode).toBe(400);
  });

  it('denies accept from anyone other than the nominated ally, over HTTP', async () => {
    const ownerUid = uid('owner');
    const allyUid = uid('ally');
    const impostorUid = uid('impostor');
    const app = buildApi([planRoutes], deps);
    await app.inject({
      method: 'PUT',
      url: '/api/v1/plan',
      headers: await authHeader(ownerUid),
      payload: {
        thresholdMinor: 500000,
        bankId: 'demo-bank',
        processingConsent: true,
        retentionMode: 'facts-24h',
        allySharingConsent: true,
        exportConsent: true,
      },
    });
    const codeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/ally-pairing-code',
      headers: await authHeader(allyUid),
    });
    const { code } = codeResponse.json() as { code: string };
    const invitationResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/ally-invitations',
      headers: await authHeader(ownerUid),
      payload: { pairingCode: code },
    });
    const invitation = invitationResponse.json() as { id: string };
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/ally-invitations/${invitation.id}/accept`,
      headers: await authHeader(impostorUid),
    });
    expect(response.statusCode).toBe(403);
  });
});
