// Open-web claim verification (PRD C7, DSN-026). Produces LABELED, UNTRUSTED
// supporting evidence that corroborates or contradicts a claimed identity.
//
// This module is deliberately separate from the sealed `verification.ts`:
// `verifyWithDemoBank` remains the only producer of a `VerificationResult`
// and the only actionable route. Nothing here imports it.
//
// Trust boundary, enforced here and not in the UI:
//  - The adapter's raw return is re-normalized to a curated institution key
//    plus a closed enum; no provider text (names, numbers, URLs,
//    instructions) is ever copied into the evidence.
//  - All output text is server templates plus a curated display name.
//  - The evidence is built with `trust:'untrusted'`, `officialRoute:null`,
//    `certifiesCaller:false`; no input changes any of them.
//  - Nothing here reads or writes plans, case phase, or policy.

import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { WebEvidenceStance, WebVerificationEvidence } from '../../../packages/contracts/src/web-verification.js';
import { maskNumber, normalizeNumber } from './fraud-list.js';
import { institutionByKey, type NumberMatch, type WebVerificationAdapter } from './web-verification-adapter.js';

const MATCHES: readonly NumberMatch[] = ['matches-pattern', 'mismatch', 'unknown'];

interface SanitizedLookup {
  institutionKey?: string;
  numberMatch: NumberMatch;
  source: 'curated-sample' | 'grounded-web';
}

/** Re-builds a lookup from only known fields; an unknown institution key or match value is dropped. */
export function sanitizeWebLookup(raw: unknown): SanitizedLookup {
  const c = (raw ?? {}) as Record<string, unknown>;
  const institution = institutionByKey(c.institutionKey);
  const claimed = MATCHES.find((m) => m === c.numberMatch) ?? 'unknown';
  const source = c.source === 'grounded-web' ? 'grounded-web' : 'curated-sample';
  // A match verdict is meaningless without a curated institution to attach it to.
  const numberMatch = institution ? claimed : 'unknown';
  return institution ? { institutionKey: institution.key, numberMatch, source } : { numberMatch, source };
}

export type WebVerifyOutcome = { ok: true; evidence: WebVerificationEvidence } | { ok: false; error: 'INVALID_NUMBER' };

export async function verifyClaimOnWeb(
  adapter: WebVerificationAdapter,
  claimedIdentity: string,
  rawNumber: string,
  now: Date,
): Promise<WebVerifyOutcome> {
  const normalized = normalizeNumber(rawNumber);
  if (!normalized) return { ok: false, error: 'INVALID_NUMBER' };

  let lookup: SanitizedLookup;
  try {
    lookup = sanitizeWebLookup(await adapter.lookup({ claimedIdentity, normalizedNumber: normalized }));
  } catch {
    lookup = { numberMatch: 'unknown', source: 'curated-sample' };
  }
  const name = institutionByKey(lookup.institutionKey)?.displayName ?? null;

  let stance: WebEvidenceStance = 'inconclusive';
  let headline = "Couldn't check this claim online";
  let detail = 'Public information was not enough to support or contradict who the caller says they are.';
  if (name && lookup.numberMatch === 'matches-pattern') {
    stance = 'corroborates';
    headline = `Number fits a published ${name} contact pattern`;
    detail = 'This only means the number looks plausible. It does not confirm who is calling.';
  } else if (name && lookup.numberMatch === 'mismatch') {
    stance = 'contradicts';
    headline = `Number does not match ${name}'s published contact pattern`;
    detail = `Public listings for ${name} do not include numbers like this one.`;
  }

  return {
    ok: true,
    evidence: {
      stance,
      institution: name,
      maskedNumber: maskNumber(normalized),
      headline,
      detail,
      trust: 'untrusted',
      source: lookup.source,
      simulated: true,
      officialRoute: null,
      certifiesCaller: false,
      checkedAt: now.toISOString(),
    },
  };
}

async function ownedCase(db: Firestore, ownerUid: string, caseId: string) {
  const ref = db.collection('cases').doc(caseId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('NOT_FOUND');
  if (snap.get('ownerUid') !== ownerUid) throw new Error('FORBIDDEN');
  return ref;
}

/** Stores the evidence on the owner's case. Never stores the raw number or the claimed-identity text. */
export async function recordWebEvidence(db: Firestore, ownerUid: string, caseId: string, evidence: WebVerificationEvidence): Promise<void> {
  const ref = await ownedCase(db, ownerUid, caseId);
  await ref.collection('webVerificationEvidence').doc(randomUUID()).set(evidence);
}

export async function listWebEvidence(db: Firestore, ownerUid: string, caseId: string): Promise<WebVerificationEvidence[]> {
  const ref = await ownedCase(db, ownerUid, caseId);
  const docs = await ref.collection('webVerificationEvidence').orderBy('checkedAt').get();
  return docs.docs.map((d) => d.data() as WebVerificationEvidence);
}
