// DSN-027 ally reach: a WhatsApp summary and the ally's contact-the-caller
// preparation. Both are derived ONLY from `readAllyPacket`, which rechecks
// every authorization predicate (accepted relationship, consent, unrevoked
// unexpired grant, packet freshness) on every call. So a revoked grant denies
// both on the very next request, and neither can ever carry more than the
// minimum packet: there is no other data source in this module.
//
// Nothing is sent from the server. The WhatsApp URL is opened by a human tap;
// the caller script is text for the ally to use. No caller phone number is
// read, stored, or dialed anywhere.

import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { AllyCallerContact, AllyPacket, AllyWhatsAppSummary } from '../../../packages/contracts/src/ally.js';
import { readAllyPacket, respondAsAlly } from './ally.js';

type Now = () => Date;
const systemNow: Now = () => new Date();

const formatAmount = (amountMinor: number): string => (amountMinor / 100).toLocaleString('en-IN');

/** Plain-text summary from the allowlisted packet fields only. */
export function summarizePacket(packet: AllyPacket): string {
  const lines = [
    'Safety Ally request (Decision Safety Network demo - simulated data)',
    `Caller claimed: ${packet.claim}`,
    `Proposed action: ${packet.proposedAction}`,
    `Amount: ${packet.amountMinor === null ? 'No amount proposed' : `Rs ${formatAmount(packet.amountMinor)}`}`,
    `Verification gap: ${packet.verificationGap}`,
  ];
  if (packet.selectedEvidence.length > 0) {
    lines.push('Shared evidence:');
    for (const item of packet.selectedEvidence) lines.push(`- "${item.excerpt}"`);
  }
  lines.push('Please open the app to respond. You cannot move money or certify the caller.');
  return lines.join('\n');
}

/** Owner-only: missing and not-owner are indistinguishable (FORBIDDEN). */
export async function assertCaseOwner(db: Firestore, ownerUid: string, caseId: string): Promise<void> {
  const snap = await db.collection('cases').doc(caseId).get();
  if (!snap.exists || snap.get('ownerUid') !== ownerUid) {
    throw new Error('FORBIDDEN');
  }
}

/**
 * Builds the WhatsApp deep link for an ally's granted packet. `allyUid` is the
 * ally whose grant the summary derives from: the owner route passes the grant
 * they created; the ally route passes the caller. No `to` number is encoded -
 * the human picks the contact in WhatsApp.
 */
export async function buildWhatsAppSummary(
  db: Firestore,
  allyUid: string,
  caseId: string,
  now: Now = systemNow,
): Promise<AllyWhatsAppSummary> {
  const packet = await readAllyPacket(db, allyUid, caseId, now);
  const text = summarizePacket(packet);
  return { caseId, text, url: `https://wa.me/?text=${encodeURIComponent(text)}`, expiresAt: packet.expiresAt };
}

/**
 * The ally's "contact the caller on the owner's behalf" action: records an
 * advisory `contact-caller` response (authorization rechecked inside
 * `respondAsAlly`) and returns a script. It never dials, never touches funds,
 * and never certifies the caller.
 */
export async function prepareCallerContact(
  db: Firestore,
  allyUid: string,
  caseId: string,
  idempotencyKey: string = randomUUID(),
  now: Now = systemNow,
): Promise<AllyCallerContact> {
  await respondAsAlly(db, allyUid, caseId, { idempotencyKey, kind: 'contact-caller' }, now);
  const packet = await readAllyPacket(db, allyUid, caseId, now);
  const script = [
    "I am the Safety Ally for someone who received a call from you. I am calling on their behalf.",
    `They were told: ${packet.claim}.`,
    'I cannot confirm who you are and I cannot approve or move any money.',
    'Please do not ask them for payments or codes. If this is genuine, they will contact the organisation using its official number.',
  ].join('\n');
  return { caseId, script, canControlFunds: false, canCertifyCaller: false };
}
