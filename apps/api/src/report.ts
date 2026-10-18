// User-submitted, pre-filled 1930/NCRP report (DSN-028). The draft builder is
// pure. The ONLY write is `recordReportHandoff`, run on the user's explicit
// action: it records the local 1930 acknowledgement through the existing
// recovery path and (optionally) adds the caller's number to the owner's
// private fraud list through the existing `addConfirmedFraud`, whose
// REPORT_NOT_RECORDED precondition is left intact. Nothing here contacts any
// authority, and nothing claims a report was filed or accepted.
import type { Firestore } from 'firebase-admin/firestore';
import { readCase } from './case-store.js';
import { NCRP_FIELD_MAP, buildManifestFacts, escapeHtml, normalizeConfirmed } from './export.js';
import { addConfirmedFraud, maskNumber, normalizeNumber } from './fraud-list.js';
import { recordAcknowledgement } from './recovery.js';
import { REPORT_DRAFT_LABEL, type ReportDraft, type ReportField, type ReportHandoffResult } from '../../../packages/contracts/src/report.js';
import type { ManifestFact, RetainedCaseProjection, RetainedConfirmed } from '../../../packages/contracts/src/evidence.js';

/** Fictional endpoint (reserved .invalid TLD): can never resolve or auto-submit anywhere. */
export const SIMULATED_NCRP_CHANNEL_URL = 'https://simulated-ncrp-channel.invalid/report';

export const RECOVERY_SCAM_WARNING =
  'Beware of recovery scams: after a fraud, people often get calls or messages from someone offering to recover or refund your lost money for a fee or "verification". Do not trust them, do not share OTPs or PINs, and do not pay anyone who contacts you first. Report only through the official channel yourself.';

/** Only facts the owner confirmed, corrected, or reported may pre-fill a field. Anything else (e.g. a raw model claim) stays blank. */
const CONFIRMED_ORIGINS = new Set(['user-confirmed', 'user-corrected', 'user-reported']);

export function buildReportDraft(caseId: string, facts: readonly ManifestFact[], now: Date = new Date()): ReportDraft {
  const confirmed = new Map(facts.filter((f) => CONFIRMED_ORIGINS.has(f.origin)).map((f) => [f.field, f] as const));
  const fields: ReportField[] = NCRP_FIELD_MAP.fields.map((entry) => {
    const fact = entry.caseField ? confirmed.get(entry.caseField) : undefined;
    return {
      ncrpField: entry.ncrpField,
      caseField: entry.caseField,
      value: fact?.value ?? '',
      blank: !fact || fact.value === '',
      provenance: fact ? { origin: fact.origin, provenanceLabel: fact.provenanceLabel, correctedAt: fact.correctedAt } : null,
    };
  });
  return {
    caseId,
    label: REPORT_DRAFT_LABEL,
    submitted: false,
    simulated: true,
    generatedAt: now.toISOString(),
    sourceDate: NCRP_FIELD_MAP.reviewedAt,
    fieldMapVersion: NCRP_FIELD_MAP.version,
    fieldMapSource: NCRP_FIELD_MAP.source,
    fields,
    recoveryScamWarning: RECOVERY_SCAM_WARNING,
    handoff: {
      mechanism: 'user-opens-official-channel',
      channelLabel: 'Simulated official 1930/NCRP channel',
      channelUrl: SIMULATED_NCRP_CHANNEL_URL,
      simulated: true,
      requiresUserAction: true,
    },
  };
}

/** Reads the case (ownership/expiry enforced) and builds its draft from confirmed facts only. */
export async function readReportDraft(db: Firestore, uid: string, caseId: string): Promise<ReportDraft> {
  const current = await readCase<RetainedCaseProjection & { confirmed?: RetainedConfirmed }>(db, uid, caseId);
  const facts = buildManifestFacts(await normalizeConfirmed(db, caseId, current.confirmed));
  return buildReportDraft(caseId, facts);
}

/** Downloadable pre-filled form for the user to review and enter/upload in the official channel themselves. */
export function renderReportDraftHtml(draft: ReportDraft): string {
  const rows = draft.fields
    .map((f) => `<tr><td>${escapeHtml(f.ncrpField)}</td><td>${escapeHtml(f.value)}</td><td>${escapeHtml(f.provenance?.provenanceLabel ?? '')}</td></tr>`)
    .join('');
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>1930/NCRP report draft - Second Voice (Simulated)</title></head>
<body>
  <p><strong>${escapeHtml(draft.label)}</strong> &middot; SIMULATED</p>
  <p>This is a pre-filled draft built only from facts you confirmed. Blank fields are unknown and were not guessed. You review it and submit it yourself through the official channel; this app does not submit it and cannot confirm any report was received.</p>
  <p><strong>${escapeHtml(draft.recoveryScamWarning)}</strong></p>
  <p>Field reference: ${escapeHtml(draft.fieldMapSource)} &middot; version ${escapeHtml(draft.fieldMapVersion)} &middot; source date ${escapeHtml(draft.sourceDate)} &middot; generated ${escapeHtml(draft.generatedAt)}</p>
  <table>${rows}</table>
</body>
</html>`;
}

/**
 * The user's explicit "I am taking this to the official channel" action. A
 * supplied caller number is validated BEFORE anything is written. The local
 * 1930 acknowledgement is recorded first (via recovery, which requires the
 * Recover phase); only then is the existing `addConfirmedFraud` called with the
 * `authority-report` basis, so its REPORT_NOT_RECORDED check is satisfied
 * legitimately, never bypassed.
 */
export async function recordReportHandoff(
  db: Firestore,
  uid: string,
  caseId: string,
  input: { idempotencyKey: string; expectedVersion?: number; callerNumber?: string },
): Promise<ReportHandoffResult> {
  const normalized = input.callerNumber === undefined ? null : normalizeNumber(input.callerNumber);
  if (input.callerNumber !== undefined && !normalized) {
    throw new Error('INVALID_BODY');
  }
  await recordAcknowledgement(db, uid, caseId, {
    kind: 'acknowledge-action',
    action: 'helpline-1930',
    key: input.idempotencyKey,
    expectedVersion: input.expectedVersion,
  });
  let fraudList: ReportHandoffResult['fraudList'] = null;
  if (normalized) {
    await addConfirmedFraud(db, uid, { caseId, normalizedNumber: normalized, basis: 'authority-report' });
    fraudList = { maskedNumber: maskNumber(normalized), basis: 'authority-report', private: true };
  }
  return {
    handedOff: true,
    filed: false,
    statement: 'You opened the official channel handoff. This app has not filed a report and cannot confirm one was received or accepted.',
    fraudList,
  };
}
