import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase, readCase } from '../src/case-store.js';
import { savePlan } from '../src/plan.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { authHeader } from './test-auth.js';
import { closeSessionWithRetention, promoteEvidence, readSelectedEvidence, revokeExportConsent } from '../src/retention.js';
import { buildExportZip } from '../src/export.js';
import { createEvidenceRoutes } from '../src/evidence-routes.js';
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

/** Reads back entry names from a ZIP buffer produced by this task's own store-only writer, by scanning local file headers (signature 0x04034b50). */
function listZipEntryNames(zip: Buffer): string[] {
  const names: string[] = [];
  let offset = 0;
  while (offset + 4 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    names.push(name);
    offset += 30 + nameLength + extraLength + compressedSize;
  }
  return names;
}

function readZipEntry(zip: Buffer, entryName: string): string {
  let offset = 0;
  while (offset + 4 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const contentStart = offset + 30 + nameLength + extraLength;
    const content = zip.subarray(contentStart, contentStart + compressedSize);
    if (name === entryName) return content.toString('utf8');
    offset = contentStart + compressedSize;
  }
  throw new Error(`ENTRY_NOT_FOUND: ${entryName}`);
}

describe('promoteEvidence / readSelectedEvidence', () => {
  it('promotes a segment and reads it back by id', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    await db.collection('cases').doc(caseId).collection('segments').doc('s1').set({ id: 's1', caseId, order: 1, speaker: 'caller', text: 'hello there', expiresAt: new Date().toISOString() });

    const excerpt = await promoteEvidence(db, ownerUid, caseId, 's1');
    const selected = await readSelectedEvidence(db, caseId, [excerpt.id, 'missing-id']);

    expect(selected).toHaveLength(1);
    expect(selected[0]?.text).toBe('hello there');
  });

  it('rejects promoting a segment for a non-owner', async () => {
    const ownerUid = uid('owner');
    const impostor = uid('impostor');
    const caseId = await seedCase(ownerUid);
    await db.collection('cases').doc(caseId).collection('segments').doc('s1').set({ id: 's1', caseId, order: 1, speaker: 'caller', text: 'hi', expiresAt: new Date().toISOString() });

    await expect(promoteEvidence(db, impostor, caseId, 's1')).rejects.toThrow('FORBIDDEN');
  });
});

describe('buildExportZip', () => {
  async function seedConfirmedCase(ownerUid: string, overrides: { exportConsent?: boolean } = {}): Promise<string> {
    const caseId = await seedCase(ownerUid, overrides);
    await db.collection('cases').doc(caseId).collection('segments').doc('s1').set({
      id: 's1', caseId, order: 1, speaker: 'caller', text: '<script>alert(1)</script> urgent, pay now', expiresAt: new Date().toISOString(),
    });
    await db.collection('cases').doc(caseId).update({
      confirmed: {
        claim: { field: 'claim', value: '<b>Your account</b> is "compromised"', origin: 'user-confirmed', sourceSegmentIds: ['s1'], uncertainty: 'low' },
        payee: { field: 'payee', value: 'proposed-new-payee', origin: 'user-confirmed', sourceSegmentIds: [], uncertainty: 'low' },
        amount: { field: 'amount', value: '999900', origin: 'user-confirmed', sourceSegmentIds: [], uncertainty: 'low' },
      },
    });
    return caseId;
  }

  it('denies export when export consent has not been given', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedConfirmedCase(ownerUid, { exportConsent: false });
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    await expect(buildExportZip(db, ownerUid, caseId)).rejects.toThrow('EXPORT_CONSENT_REQUIRED');
  });

  it('denies export after export consent is revoked, even though the case remains open', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedConfirmedCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');
    await revokeExportConsent(db, ownerUid, caseId);

    await expect(buildExportZip(db, ownerUid, caseId)).rejects.toThrow('EXPORT_CONSENT_REQUIRED');
  });

  it('produces exactly brief.html, provenance.json, and ncrp-preview.html', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedConfirmedCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    const { zip, filename } = await buildExportZip(db, ownerUid, caseId);

    expect(filename).toMatch(/\.zip$/);
    expect(listZipEntryNames(zip).sort()).toEqual(['brief.html', 'ncrp-preview.html', 'provenance.json'].sort());
  });

  it('HTML-escapes malicious user/model text in both brief.html and ncrp-preview.html', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedConfirmedCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    const { zip } = await buildExportZip(db, ownerUid, caseId);
    const brief = readZipEntry(zip, 'brief.html');
    const ncrp = readZipEntry(zip, 'ncrp-preview.html');

    expect(brief).not.toContain('<script>alert(1)</script>');
    expect(brief).not.toContain('<b>Your account</b>');
    expect(brief).toContain('&lt;b&gt;Your account&lt;/b&gt;');
    expect(ncrp).not.toContain('<script>');
  });

  it('labels the brief and the NCRP preview as simulated, and the NCRP preview explicitly as not submitted or accepted', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedConfirmedCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    const { zip } = await buildExportZip(db, ownerUid, caseId);
    const brief = readZipEntry(zip, 'brief.html');
    const ncrp = readZipEntry(zip, 'ncrp-preview.html');

    expect(brief).toMatch(/simulated/i);
    expect(ncrp).toMatch(/simulated/i);
    expect(ncrp).toMatch(/not submitted or accepted/i);
    expect(brief).not.toMatch(/probability/i);
    expect(brief).not.toMatch(/mental state/i);
  });

  it('leaves unsupported NCRP fields blank rather than guessing, and pins a dated field-map source', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedConfirmedCase(ownerUid);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    const { zip } = await buildExportZip(db, ownerUid, caseId);
    const ncrp = readZipEntry(zip, 'ncrp-preview.html');

    expect(ncrp).toMatch(/field map source/i);
    expect(ncrp).toMatch(/version/i);
    expect(ncrp).toMatch(/reviewed/i);
  });

  it('never fills an actual-paid field from the proposed payee/amount - only an explicitly user-reported paidPayment counts as actually paid', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedConfirmedCase(ownerUid); // payee/amount are proposed only, no paidPayment reported
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    const { zip } = await buildExportZip(db, ownerUid, caseId);
    const brief = readZipEntry(zip, 'brief.html');

    expect(brief).toMatch(/no actual payment has been reported/i);
  });

  it('separates a user-reported actual paid payment from the proposed transfer', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedConfirmedCase(ownerUid);
    await db.collection('cases').doc(caseId).update({
      'confirmed.paidPayment': { payeeId: 'actual-safe-payee', amountMinor: 42000, origin: 'user-reported', reportedAt: new Date().toISOString() },
    });
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    const { zip } = await buildExportZip(db, ownerUid, caseId);
    const brief = readZipEntry(zip, 'brief.html');
    const provenance = JSON.parse(readZipEntry(zip, 'provenance.json')) as { facts: Array<{ field: string; value: string }> };

    expect(brief).toContain('actual-safe-payee');
    expect(brief).not.toMatch(/no actual payment has been reported/i);
    const paidFields = provenance.facts.filter((f) => f.field.startsWith('paidPayment'));
    expect(paidFields.length).toBeGreaterThanOrEqual(2);
  });

  it('exports only the selected excerpt and its sourced facts under selected-7d, omitting everything else', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedConfirmedCase(ownerUid);
    await promoteEvidence(db, ownerUid, caseId, 's1');
    await closeSessionWithRetention(db, ownerUid, caseId, 'selected-7d');

    const retained = await readCase<RetainedCaseProjection>(db, ownerUid, caseId);
    expect(retained.confirmed.claim?.provenanceLabel).toBe('selected evidence');

    const { zip } = await buildExportZip(db, ownerUid, caseId);
    const provenance = JSON.parse(readZipEntry(zip, 'provenance.json')) as { facts: Array<{ field: string; provenanceLabel: string }> };
    const claimFact = provenance.facts.find((f) => f.field === 'claim');
    expect(claimFact?.provenanceLabel).toBe('selected evidence');
  });

  it('exports an OPEN (never-closed) case with raw facts, normalizing them to the retained manifest shape', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedConfirmedCase(ownerUid);
    await db.collection('cases').doc(caseId).update({
      'confirmed.paidPayment': { payeeId: 'actual-safe-payee', amountMinor: 42000, origin: 'user-reported', reportedAt: new Date().toISOString() },
    });

    const { zip } = await buildExportZip(db, ownerUid, caseId);
    const brief = readZipEntry(zip, 'brief.html');
    const provenance = JSON.parse(readZipEntry(zip, 'provenance.json')) as {
      facts: Array<{ field: string; provenanceLabel: string; sourceIds: string[]; correctedAt: string | null }>;
    };

    expect(brief).toContain('&lt;b&gt;Your account&lt;/b&gt;');
    expect(brief).not.toContain('<b>Your account</b>');
    expect(brief).toContain('actual-safe-payee');
    expect(readZipEntry(zip, 'ncrp-preview.html')).not.toContain('undefined');
    const claim = provenance.facts.find((f) => f.field === 'claim');
    // s1 was never promoted, so its source is not retained evidence.
    expect(claim?.provenanceLabel).toBe('source not retained');
    expect(claim?.sourceIds).toEqual([]);
    expect(claim?.correctedAt).toBeNull();
  });

  it('labels an open-case fact "selected evidence" once its citing segment has been promoted', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedConfirmedCase(ownerUid);
    await promoteEvidence(db, ownerUid, caseId, 's1');

    const { zip } = await buildExportZip(db, ownerUid, caseId);
    const provenance = JSON.parse(readZipEntry(zip, 'provenance.json')) as { facts: Array<{ field: string; provenanceLabel: string; sourceIds: string[] }> };
    const claim = provenance.facts.find((f) => f.field === 'claim');
    expect(claim?.provenanceLabel).toBe('selected evidence');
    expect(claim?.sourceIds).toEqual(['s1']);
  });

  it('preserves a correction in the exported brief while its original source excerpt is separately retained', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedConfirmedCase(ownerUid);
    await promoteEvidence(db, ownerUid, caseId, 's1');
    await db.collection('cases').doc(caseId).update({
      'confirmed.payee': { field: 'payee', value: 'corrected-safe-payee', origin: 'user-corrected', sourceSegmentIds: [], uncertainty: 'low' },
    });
    await closeSessionWithRetention(db, ownerUid, caseId, 'selected-7d');

    const { zip } = await buildExportZip(db, ownerUid, caseId);
    const brief = readZipEntry(zip, 'brief.html');
    expect(brief).toContain('corrected-safe-payee');
  });
});

describe('HTTP routes: promote, selected-evidence, export, export-consent revoke', () => {
  it('promotes via POST and reads back via GET with real auth', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    await db.collection('cases').doc(caseId).collection('segments').doc('s1').set({ id: 's1', caseId, order: 1, speaker: 'caller', text: 'hi there', expiresAt: new Date().toISOString() });
    const app = buildApi([createEvidenceRoutes()], deps);
    const headers = await authHeader(ownerUid);

    const promoteResponse = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/evidence/s1/promote`, headers });
    expect(promoteResponse.statusCode).toBe(200);
    const promoted = promoteResponse.json() as { id: string };

    const readResponse = await app.inject({ method: 'GET', url: `/api/v1/cases/${caseId}/evidence?ids=${promoted.id}`, headers });
    expect(readResponse.statusCode).toBe(200);
    expect((readResponse.json() as Array<{ text: string }>)[0]?.text).toBe('hi there');
  });

  it('rejects a non-owner promoting evidence with 403', async () => {
    const ownerUid = uid('owner');
    const impostor = uid('impostor');
    const caseId = await seedCase(ownerUid);
    await db.collection('cases').doc(caseId).collection('segments').doc('s1').set({ id: 's1', caseId, order: 1, speaker: 'caller', text: 'hi', expiresAt: new Date().toISOString() });
    const app = buildApi([createEvidenceRoutes()], deps);

    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/evidence/s1/promote`, headers: await authHeader(impostor) });
    expect(response.statusCode).toBe(403);
  });

  it('exports a zip over HTTP with the correct content-type', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    await db.collection('cases').doc(caseId).update({ confirmed: { claim: { field: 'claim', value: 'test', origin: 'user-confirmed', sourceSegmentIds: [], uncertainty: 'low' } } });
    const app = buildApi([createEvidenceRoutes()], deps);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');

    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/export`, headers: await authHeader(ownerUid) });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/zip');
  });

  it('revokes export consent over HTTP, then export is denied', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const app = buildApi([createEvidenceRoutes()], deps);
    await closeSessionWithRetention(db, ownerUid, caseId, 'facts-24h');
    const headers = await authHeader(ownerUid);

    const revokeResponse = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/export-consent/revoke`, headers });
    expect(revokeResponse.statusCode).toBe(204);

    const exportResponse = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/export`, headers });
    expect(exportResponse.statusCode).toBe(403);
  });

  it('rejects an unauthenticated export request with 401', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const app = buildApi([createEvidenceRoutes()], deps);

    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/export` });
    expect(response.statusCode).toBe(401);
  });
});
