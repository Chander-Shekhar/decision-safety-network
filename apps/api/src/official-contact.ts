// Resolves the one actionable Decide-step contact (DSN-038): a number the owner
// can call to reach the organisation the caller CLAIMS to be, so they verify
// independently instead of calling a number the caller handed them.
//
// Trust posture (decision 0021, founder-authorised override of PRD C7 for this
// one action): unlike `web-verification.ts`, the surfaced number IS an actionable
// route. Two sources only:
//  - Demo Bank (fictional): its curated, hardcoded registry number. Deterministic,
//    so the Cup demo and the curated/offline build always show the call button.
//  - Any real organisation: an OPEN LLM web search (`OfficialContactLookup`) for
//    that org's own official public contact number. The claimed identity IS
//    forwarded to the model here (the deliberate difference from DSN-031's sealed
//    grounding) - the founder's call: a big organisation's official listing
//    outranks anything an attacker could plant.
//
// A caller-supplied number is NEVER a source: the only inputs are the extracted
// claimed-identity text and the server's own demo registry. When no official
// number is found the result is `phoneNumber: null` and the UI hides the action.

import type { Firestore } from 'firebase-admin/firestore';
import type { OfficialContact } from '../../../packages/contracts/src/official-contact.js';
import { DEMO_BANK_REGISTRY } from './demo-bank-registry.js';

/** The raw shape an `OfficialContactLookup` may return; re-validated by `resolveOfficialContact`. */
export interface OfficialContactRaw {
  organisation: string | null;
  phoneNumber: string | null;
}

/**
 * Open web search for a real organisation's official public contact number.
 * `claimedIdentity` is caller/transcript-derived and forwarded to the model
 * (decision 0021). May throw; `resolveOfficialContact` degrades a throw to "no
 * number found". Implemented live by `gemini.ts`'s
 * `createGeminiOfficialContactLookup()`; tests and the Cup default inject a
 * deterministic double (`createCuratedOfficialContactLookup`).
 */
export interface OfficialContactLookup {
  findNumber(query: { claimedIdentity: string }): Promise<OfficialContactRaw>;
}

/**
 * Deterministic default (Cup / offline build and tests): never performs a live
 * search, so it only ever resolves Demo Bank (handled upstream in
 * `resolveOfficialContact`) and reports no number for every real organisation.
 */
export function createCuratedOfficialContactLookup(): OfficialContactLookup {
  return {
    async findNumber() {
      return { organisation: null, phoneNumber: null };
    },
  };
}

/** Reduces an arbitrary model-returned string to a dialable `tel:` value (digits, optional leading `+`), or null. Permits short helpline codes. */
export function toDialable(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 3 || digits.length > 15) return null;
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/** True when the claimed identity names the fictional Demo Bank (demo path uses the curated registry number). */
function isDemoBank(claimedIdentity: string): boolean {
  return /\bdemo bank\b/i.test(claimedIdentity);
}

/**
 * Resolves the callable official contact for a claimed identity. Demo Bank uses
 * the curated registry number; any other organisation is looked up live via
 * `lookup`. The returned number is always re-sanitized to digits (+ optional
 * leading `+`), never passed through raw.
 */
export async function resolveOfficialContact(
  lookup: OfficialContactLookup,
  claimedIdentity: string,
): Promise<OfficialContact> {
  if (!claimedIdentity.trim()) {
    return { organisation: null, phoneNumber: null, source: 'web-search' };
  }
  if (isDemoBank(claimedIdentity)) {
    return { organisation: 'Demo Bank', phoneNumber: toDialable(DEMO_BANK_REGISTRY.contactNumber), source: 'demo-registry' };
  }
  let raw: OfficialContactRaw;
  try {
    raw = await lookup.findNumber({ claimedIdentity });
  } catch {
    return { organisation: null, phoneNumber: null, source: 'web-search' };
  }
  const organisation = typeof raw.organisation === 'string' && raw.organisation.trim() ? raw.organisation.trim() : null;
  return { organisation, phoneNumber: toDialable(raw.phoneNumber), source: 'web-search' };
}

async function ownedCase(db: Firestore, ownerUid: string, caseId: string) {
  const snap = await db.collection('cases').doc(caseId).get();
  if (!snap.exists) throw new Error('NOT_FOUND');
  if (snap.get('ownerUid') !== ownerUid) throw new Error('FORBIDDEN');
}

/** Owner-scoped resolve: asserts ownership of the case, then resolves the contact. Stores nothing (the number is not sensitive and is re-derived on demand). */
export async function officialContactForCase(
  db: Firestore,
  ownerUid: string,
  caseId: string,
  lookup: OfficialContactLookup,
  claimedIdentity: string,
): Promise<OfficialContact> {
  await ownedCase(db, ownerUid, caseId);
  return resolveOfficialContact(lookup, claimedIdentity);
}
