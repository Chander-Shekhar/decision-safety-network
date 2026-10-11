// Private confirmed-fraud list (PRD C13, DSN-024). Scoped to the owner who
// confirmed: it only ever warns that same recipient before pickup. There is
// no public read, no cross-user read, and no criminal attribution. The ONLY
// writer is `addConfirmedFraud` (explicit owner confirmation, or an
// authority report the case has already recorded). Nothing derived from a
// raw caller-ID / web signal can reach it.

import { createHmac } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { FraudListBasis, FraudListEntry } from '../../../packages/contracts/src/screening.js';

/** Digits with optional leading +. 10-digit numbers are treated as +91 (demo region). Returns null if not a plausible number. */
export function normalizeNumber(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export function maskNumber(normalized: string): string {
  return `${normalized.slice(0, 3)} ••••• ••${normalized.slice(-3)}`;
}

/**
 * DEV-ONLY default key. Obviously non-production and NOT a secret: real
 * deployments must set FRAUD_LIST_HMAC_SECRET (decision 0011). Without it the
 * stored key is only as private as this public constant.
 */
export const DEV_ONLY_FRAUD_LIST_HMAC_SECRET = 'dev-only-not-a-secret-fraud-list-key';

/** Keyed, deterministic, non-reversible-without-the-secret identifier for a normalized number. */
export function identifierId(normalized: string): string {
  const secret = process.env.FRAUD_LIST_HMAC_SECRET || DEV_ONLY_FRAUD_LIST_HMAC_SECRET;
  return createHmac('sha256', secret).update(normalized).digest('hex');
}

function entries(db: Firestore, ownerUid: string) {
  return db.collection('fraudLists').doc(ownerUid).collection('entries');
}

export async function isOnFraudList(db: Firestore, ownerUid: string, normalized: string): Promise<boolean> {
  const snap = await entries(db, ownerUid).doc(identifierId(normalized)).get();
  return snap.exists;
}

/**
 * Adds a caller identifier to the owner's private list. Requires a case the
 * owner owns. `user-confirmed` is the owner's explicit fraud confirmation;
 * `authority-report` additionally requires the case to already carry a
 * recorded 1930 acknowledgement (`REPORT_NOT_RECORDED` otherwise). Idempotent.
 */
export async function addConfirmedFraud(
  db: Firestore,
  ownerUid: string,
  input: { caseId: string; normalizedNumber: string; basis: FraudListBasis },
): Promise<FraudListEntry> {
  const caseSnap = await db.collection('cases').doc(input.caseId).get();
  if (!caseSnap.exists || caseSnap.get('ownerUid') !== ownerUid) {
    throw new Error('FORBIDDEN');
  }
  if (input.basis === 'authority-report') {
    const ack = caseSnap.get('recoveryAcknowledgement') as { action?: string } | undefined;
    if (ack?.action !== 'helpline-1930') {
      throw new Error('REPORT_NOT_RECORDED');
    }
  }
  const id = identifierId(input.normalizedNumber);
  const ref = entries(db, ownerUid).doc(id);
  const existing = await ref.get();
  if (existing.exists) {
    return existing.data() as FraudListEntry;
  }
  const entry: FraudListEntry = {
    id,
    maskedNumber: maskNumber(input.normalizedNumber),
    basis: input.basis,
    caseId: input.caseId,
    addedAt: new Date().toISOString(),
  };
  await ref.set(entry);
  return entry;
}

/** Owner's own entries (masked display only). */
export async function listFraudEntries(db: Firestore, ownerUid: string): Promise<FraudListEntry[]> {
  const snap = await entries(db, ownerUid).get();
  return snap.docs.map((d) => d.data() as FraudListEntry);
}

/**
 * Owner forget path (decision 0011). The list is deliberately durable across
 * cases but always owner-removable. Scoped by `ownerUid`, so one user can never
 * touch another's entries. Throws NOT_FOUND if the entry is not on the owner's list.
 */
export async function removeFraudEntry(db: Firestore, ownerUid: string, id: string): Promise<void> {
  const ref = entries(db, ownerUid).doc(id);
  if (!(await ref.get()).exists) {
    throw new Error('NOT_FOUND');
  }
  await ref.delete();
}

export async function clearFraudList(db: Firestore, ownerUid: string): Promise<number> {
  const snap = await entries(db, ownerUid).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
  return snap.size;
}
