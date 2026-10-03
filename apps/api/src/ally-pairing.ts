import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

/** A pairing code is single-use and expires quickly; it only ever binds one ally UID. */
const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

export interface PairingCodeIssued {
  code: string;
  expiresAt: string;
}

interface PairingCodeDoc {
  allyUid: string;
  expiresAt: string;
  consumedAt: string | null;
}

/**
 * Issues a short-lived, single-use pairing code bound to the requesting
 * ally's own UID. The owner later redeems it (via `consumePairingCode`,
 * called from `plan.ts`'s `createInvitation`) to nominate that same UID -
 * the code never carries case data, only an identity binding.
 */
export async function issuePairingCode(db: Firestore, allyUid: string): Promise<PairingCodeIssued> {
  const code = randomUUID().replace(/-/g, '').slice(0, 8);
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString();
  const doc: PairingCodeDoc = { allyUid, expiresAt, consumedAt: null };
  await db.collection('allyPairingCodes').doc(code).create(doc);
  return { code, expiresAt };
}

/**
 * Atomically validates and consumes a pairing code, returning the ally UID
 * it was bound to. Rejects an unknown code, an already-consumed (reused)
 * code, an expired code, and self-nomination (the code's ally UID equals
 * the redeeming owner's UID) - in that order, before any write.
 */
export async function consumePairingCode(db: Firestore, ownerUid: string, code: string): Promise<string> {
  return db.runTransaction(async (tx) => {
    const ref = db.collection('allyPairingCodes').doc(code);
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error('PAIRING_CODE_NOT_FOUND');
    }
    const data = snap.data() as PairingCodeDoc;
    if (data.consumedAt !== null) {
      throw new Error('PAIRING_CODE_CONSUMED');
    }
    if (data.expiresAt <= new Date().toISOString()) {
      throw new Error('PAIRING_CODE_EXPIRED');
    }
    if (data.allyUid === ownerUid) {
      throw new Error('SELF_NOMINATION');
    }
    tx.update(ref, { consumedAt: new Date().toISOString() });
    return data.allyUid;
  });
}
