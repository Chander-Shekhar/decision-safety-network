// Export (evidence download) logic for Task 11 (DSN-013). Produces exactly
// three entries: a reviewable brief, a provenance manifest, and an NCRP
// field-aligned preview. No PDF service is added - EvidenceScreen offers the
// browser's own print/save-to-PDF for the brief.
import { crc32 } from 'node:zlib';
import type { Firestore } from 'firebase-admin/firestore';
import { readCase } from './case-store.js';
import { buildRetainedConfirmed } from './retention.js';
import type { Fact } from '../../../packages/contracts/src/facts.js';
import type { ManifestFact, RetainedPaidPayment, RetainedCaseProjection, RetainedConfirmed } from '../../../packages/contracts/src/evidence.js';

// --- Minimal, dependency-free ZIP writer -----------------------------------
// No zip library is pinned anywhere in this repo (see apps/api/package.json);
// see project/decisions/0005-dsn013-minimal-zip-writer.md. Every entry is
// stored uncompressed (method 0) - for three small, already-text entries,
// storing uncompressed trades a few KB for zero new dependencies and a
// format simple enough to verify by direct byte inspection in tests.

interface ZipEntryInput {
  name: string;
  content: Buffer;
}

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;

export function buildZip(entries: readonly ZipEntryInput[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.content) as unknown as number;
    const size = entry.content.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
    localHeader.writeUInt16LE(20, 4); // version needed to extract
    localHeader.writeUInt16LE(0, 6); // general purpose flags
    localHeader.writeUInt16LE(0, 8); // compression method: stored
    localHeader.writeUInt16LE(0, 10); // DOS time (not meaningful here - provenance.json carries the real generatedAt timestamp)
    localHeader.writeUInt16LE(0, 12); // DOS date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18); // compressed size == size (stored)
    localHeader.writeUInt32LE(size, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length
    localParts.push(localHeader, nameBuf, entry.content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(CENTRAL_DIR_HEADER_SIG, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed to extract
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(0, 10); // compression method
    centralHeader.writeUInt16LE(0, 12); // DOS time
    centralHeader.writeUInt16LE(0, 14); // DOS date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attributes
    centralHeader.writeUInt32LE(0, 38); // external attributes
    centralHeader.writeUInt32LE(offset, 42); // relative offset of this entry's local header
    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + entry.content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const centralDirectoryOffset = offset;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIR_SIG, 0);
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // disk with central directory start
  end.writeUInt16LE(entries.length, 8); // entries on this disk
  end.writeUInt16LE(entries.length, 10); // total entries
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, centralDirectory, end]);
}

// --- HTML rendering ---------------------------------------------------------

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A locally maintained, versioned reference mapping this case's confirmed
 * fields onto NCRP-style field names - mirrors `demo-bank-registry.ts`'s own
 * pinned, dated-registry style. Not the official NCRP form and never
 * fetched from any government source; several `caseField` entries are
 * intentionally `null` (no supported case field maps to them yet), which is
 * exactly what keeps those rows blank rather than guessed.
 */
export const NCRP_FIELD_MAP = {
  version: 'cup-1',
  source: 'local fictional NCRP-style field reference',
  reviewedAt: '2026-10-02',
  fields: [
    { ncrpField: 'Complainant name', caseField: null },
    { ncrpField: "Caller's claimed identity", caseField: 'claimedIdentity' },
    { ncrpField: 'Central claim or threat', caseField: 'centralClaim' },
    { ncrpField: 'Requested action', caseField: 'requestedAction' },
    { ncrpField: 'Proposed transfer amount', caseField: 'amount' },
    { ncrpField: 'Proposed transfer payee', caseField: 'payee' },
    { ncrpField: 'Actual amount paid', caseField: 'paidPayment.amountMinor' },
    { ncrpField: 'Actual payee paid', caseField: 'paidPayment.payeeId' },
    { ncrpField: 'Transaction reference', caseField: null },
    { ncrpField: 'Deadline given by caller', caseField: 'deadline' },
    { ncrpField: 'Observed tactics', caseField: 'observedTactics' },
  ],
} as const;

/** Flattens a case's retained confirmed-facts map into the manifest shape `provenance.json`/the brief/the NCRP preview all share. A paid-payment entry becomes two manifest facts (`paidPayment.payeeId`/`paidPayment.amountMinor`) so it can never be confused with, or silently merged into, the proposed payee/amount. */
function buildManifestFacts(confirmed: RetainedConfirmed): ManifestFact[] {
  const facts: ManifestFact[] = [];
  for (const [field, value] of Object.entries(confirmed)) {
    if ('reportedAt' in value) {
      facts.push({ field: 'paidPayment.payeeId', value: value.payeeId, origin: value.origin, sourceIds: [], provenanceLabel: value.provenanceLabel, correctedAt: null });
      facts.push({ field: 'paidPayment.amountMinor', value: String(value.amountMinor), origin: value.origin, sourceIds: [], provenanceLabel: value.provenanceLabel, correctedAt: null });
      continue;
    }
    facts.push({ field, value: value.value, origin: value.origin, sourceIds: value.sourceIds, provenanceLabel: value.provenanceLabel, correctedAt: value.correctedAt });
  }
  return facts;
}

/**
 * A pre-close case still holds raw `Fact`/paid-payment entries (no
 * `provenanceLabel`), whereas a closed case holds the retained shape. Any
 * entry lacking `provenanceLabel` is run through the same
 * `buildRetainedConfirmed` convention `pruneToRetained` uses, against the
 * segment ids currently promoted to `evidence`, so pre- and post-close
 * exports label provenance identically.
 */
async function normalizeConfirmed(db: Firestore, caseId: string, confirmed: Record<string, unknown> | undefined): Promise<RetainedConfirmed> {
  const result: RetainedConfirmed = {};
  const raw: Record<string, Fact | RetainedPaidPayment> = {};
  for (const [field, value] of Object.entries(confirmed ?? {})) {
    if (typeof value === 'object' && value !== null && 'provenanceLabel' in value) {
      result[field] = value as RetainedConfirmed[string];
    } else {
      raw[field] = value as Fact | RetainedPaidPayment;
    }
  }
  if (Object.keys(raw).length === 0) {
    return result;
  }
  const evidenceSnap = await db.collection('cases').doc(caseId).collection('evidence').get();
  const retainedSegmentIds = new Set(evidenceSnap.docs.map((d) => d.id));
  return { ...result, ...buildRetainedConfirmed(raw, retainedSegmentIds) };
}

function renderFactRow(label: string, fact: ManifestFact | undefined): string {
  if (!fact) {
    return `<tr><td>${escapeHtml(label)}</td><td></td><td></td><td></td></tr>`;
  }
  return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(fact.value)}</td><td>${escapeHtml(fact.provenanceLabel)}</td><td>${escapeHtml(fact.correctedAt ?? '')}</td></tr>`;
}

function renderBriefHtml(current: RetainedCaseProjection, facts: ManifestFact[]): string {
  const byField = new Map(facts.map((f) => [f.field, f] as const));
  const excludedFromOther = new Set(['payee', 'amount', 'paidPayment.payeeId', 'paidPayment.amountMinor']);
  const otherRows = facts.filter((f) => !excludedFromOther.has(f.field)).map((f) => renderFactRow(f.field, f)).join('');

  const paidPayeeFact = byField.get('paidPayment.payeeId');
  const paidAmountFact = byField.get('paidPayment.amountMinor');
  const paidSection = paidPayeeFact || paidAmountFact
    ? `<p>The user reported the following payment actually left the account, confirmed by explicit match or edit - this is never inferred from the proposed transfer above:</p>
       <table>${renderFactRow('Actual paid payee', paidPayeeFact)}${renderFactRow('Actual paid amount (minor units)', paidAmountFact)}</table>`
    : '<p>No actual payment has been reported by the user. This section is left blank, not inferred from the proposed transfer above.</p>';

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Case brief - Decision Safety Network (Simulated)</title></head>
<body>
  <p><strong>SIMULATED</strong> - this is a reviewable brief generated from your own case. No authority has been contacted and nothing has been submitted on your behalf.</p>
  <h1>Case brief</h1>
  <p>Case ID: ${escapeHtml(current.id)}</p>
  <p>Generated: ${escapeHtml(new Date().toISOString())}</p>

  <h2>Caller's claim and proposed transfer</h2>
  <p>The values below are the caller's claim and the transfer the user considered, as confirmed or corrected by the user. They describe what was said, not a verified fact about any real account or institution.</p>
  <table>${renderFactRow('payee (proposed)', byField.get('payee'))}${renderFactRow('amount (proposed)', byField.get('amount'))}${otherRows}</table>

  <h2>Actual payment (user-reported)</h2>
  ${paidSection}

  <p>Simulated acknowledgement: the user acknowledged this is a simulated prototype decision aid, not a bank, government, or law-enforcement system.</p>
</body>
</html>`;
}

function renderNcrpPreviewHtml(facts: ManifestFact[]): string {
  const byField = new Map(facts.map((f) => [f.field, f] as const));
  const rows = NCRP_FIELD_MAP.fields
    .map((entry) => renderFactRow(entry.ncrpField, entry.caseField ? byField.get(entry.caseField) : undefined))
    .join('');

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>NCRP field-aligned preview - Decision Safety Network (Simulated)</title></head>
<body>
  <p><strong>SIMULATED &middot; field-aligned preview &mdash; not submitted or accepted</strong></p>
  <p>This preview maps this case's confirmed facts onto a locally maintained, versioned reference of NCRP-style field names. It is not the official NCRP form, was not generated by any government system, and nothing on this page has been submitted to or accepted by any authority. Fields with no confirmed value are left blank, never guessed.</p>
  <p>Field map source: ${escapeHtml(NCRP_FIELD_MAP.source)} &middot; version ${escapeHtml(NCRP_FIELD_MAP.version)} &middot; reviewed ${escapeHtml(NCRP_FIELD_MAP.reviewedAt)}</p>
  <table>${rows}</table>
</body>
</html>`;
}

async function readLiveExportConsent(db: Firestore, ownerUid: string): Promise<boolean> {
  const snap = await db.collection('plans').doc(ownerUid).get();
  return snap.exists ? Boolean(snap.get('exportConsent')) : false;
}

export interface ExportResult {
  filename: string;
  zip: Buffer;
}

/**
 * Builds the evidence export ZIP. `readCase` enforces ownership (`FORBIDDEN`)
 * and logical expiry (`EXPIRED`/410) before export consent is even checked.
 * A pre-close case has no `exportConsent` snapshot of its own yet, so this
 * falls back to the owner's live Plan value; a closed case's own snapshot
 * (set at close time, and mutable afterward only via `revokeExportConsent`)
 * takes precedence once present.
 */
export async function buildExportZip(db: Firestore, uid: string, caseId: string): Promise<ExportResult> {
  const current = await readCase<RetainedCaseProjection & { confirmed?: RetainedConfirmed }>(db, uid, caseId);

  const exportConsent = typeof current.exportConsent === 'boolean' ? current.exportConsent : await readLiveExportConsent(db, current.ownerUid);
  if (!exportConsent) {
    throw new Error('EXPORT_CONSENT_REQUIRED');
  }

  const facts = buildManifestFacts(await normalizeConfirmed(db, caseId, current.confirmed));
  const provenance = {
    caseId: current.id,
    generatedAt: new Date().toISOString(),
    retentionMode: current.retentionMode ?? null,
    facts,
  };

  const zip = buildZip([
    { name: 'brief.html', content: Buffer.from(renderBriefHtml(current, facts), 'utf8') },
    { name: 'provenance.json', content: Buffer.from(JSON.stringify(provenance, null, 2), 'utf8') },
    { name: 'ncrp-preview.html', content: Buffer.from(renderNcrpPreviewHtml(facts), 'utf8') },
  ]);

  return { filename: `evidence-${current.id}.zip`, zip };
}
