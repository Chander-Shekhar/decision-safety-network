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
import type { AllyCallerContact, AllyPacket, AllySharer, AllyWhatsAppSummary } from '../../../packages/contracts/src/ally.js';
import { toWhatsAppNumber } from '../../../packages/contracts/src/profile.js';
import { readAllyPacket, respondAsAlly } from './ally.js';
import { getProfile } from './profile.js';

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
  if (packet.summary.trim().length > 0) {
    lines.push('', `Summary: ${packet.summary}`);
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
 * they created; the ally route passes the caller. With `toAlly`, the chat opens
 * straight to the ally's own self-entered mobile (looked up live by uid); with no
 * usable number it falls back to the generic link and the human picks the contact.
 */
export async function buildWhatsAppSummary(
  db: Firestore,
  allyUid: string,
  caseId: string,
  now: Now = systemNow,
  toAlly = false,
): Promise<AllyWhatsAppSummary> {
  const packet = await readAllyPacket(db, allyUid, caseId, now);
  const text = summarizePacket(packet);
  const to = toAlly ? toWhatsAppNumber((await getProfile(db, allyUid)).mobile) : null;
  return { caseId, text, url: `https://wa.me/${to ?? ''}?text=${encodeURIComponent(text)}`, expiresAt: packet.expiresAt };
}

/**
 * Who shared this case: the owner's self-entered name + mobile, so the ally knows
 * whom to reach. Gated by `readAllyPacket` (every authorization predicate rechecked,
 * so a revoked grant denies on the next request); never part of the packet itself.
 */
export async function readSharer(db: Firestore, allyUid: string, caseId: string, now: Now = systemNow): Promise<AllySharer> {
  await readAllyPacket(db, allyUid, caseId, now);
  const ownerUid = (await db.collection('cases').doc(caseId).get()).get('ownerUid') as string;
  return { caseId, ...(await getProfile(db, ownerUid)) };
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
