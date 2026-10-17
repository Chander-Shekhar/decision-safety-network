import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import type { CaseEnvelope } from '../../../packages/contracts/src/case.js';
import type {
  AllyGrant,
  AllyGrantedCase,
  AllyPacket,
  AllyPacketContent,
  AllyPreview,
  AllyResponse,
} from '../../../packages/contracts/src/ally.js';
import type { Fact } from '../../../packages/contracts/src/facts.js';
import type { PaymentDraft } from '../../../packages/contracts/src/payment.js';
import type { Plan } from '../../../packages/contracts/src/plan.js';
import { hasAcceptedRelationship } from './plan.js';

/** How long one case grant stays readable, capped by the case's own expiry. */
const GRANT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_VERIFICATION_GAP = 'Caller not independently verified';
const UNKNOWN_FACT = 'Unknown';

type Now = () => Date;
const systemNow: Now = () => new Date();

/** The case fields this module reads (never the whole document - the packet is built by allowlisting). */
interface AllyReadableCase extends CaseEnvelope {
  facts?: Record<string, Fact>;
  confirmed?: Record<string, Fact>;
  paymentDraft?: PaymentDraft;
}

function caseRef(db: Firestore, caseId: string) {
  return db.collection('cases').doc(caseId);
}

function grantRef(db: Firestore, caseId: string, allyUid: string) {
  return caseRef(db, caseId).collection('allyGrants').doc(allyUid);
}

/** A confirmed fact wins over the model's live one; a placeholder or missing value falls back. */
function factValue(current: AllyReadableCase, field: string, fallback: string): string {
  const value = current.confirmed?.[field]?.value ?? current.facts?.[field]?.value;
  if (typeof value !== 'string' || value.trim() === '' || value.trim().toLowerCase() === 'unknown') {
    return fallback;
  }
  return value;
}

const formatAmountMinor = (amountMinor: number): string => `Rs ${(amountMinor / 100).toLocaleString('en-IN')}`;
const lowerFirst = (s: string): string => (s.length > 0 ? s[0]!.toLowerCase() + s.slice(1) : s);

/**
 * A short, plain-language gist of the call for the ally, composed from the
 * case's AI-extracted facts (never raw transcript excerpts). Deterministic -
 * a pure function of the stored, allowlisted fields - so the packet hash
 * stays stable until the underlying facts change. The ally gets the shape of
 * the situation and can reach the owner for detail; the full transcript is
 * never shared.
 */
function composeSummary(current: AllyReadableCase): string {
  const who = factValue(current, 'claimedIdentity', '');
  const claim = factValue(current, 'centralClaim', '');
  const action = factValue(current, 'requestedAction', '');
  const tactics = factValue(current, 'observedTactics', '');
  const amountMinor = typeof current.paymentDraft?.amountMinor === 'number' ? current.paymentDraft.amountMinor : null;

  const parts: string[] = [];
  parts.push(`${who || 'A caller'} contacted them${claim ? `, claiming ${lowerFirst(claim)}` : ''}.`);
  if (action) {
    parts.push(`They were pushed to ${lowerFirst(action)}${amountMinor !== null ? ` (${formatAmountMinor(amountMinor)})` : ''}.`);
  }
  if (tactics) parts.push(`Pressure noticed: ${lowerFirst(tactics)}.`);
  parts.push('The caller has not been independently verified.');
  return parts.join(' ');
}

/**
 * Builds the packet content field by field (an allowlist), from the case's
 * current facts and payment draft. No transcript excerpts are read or sent;
 * the `summary` is composed from the extracted facts.
 */
function buildAllowlistedPacket(current: AllyReadableCase): AllyPacketContent {
  return {
    claim: factValue(current, 'centralClaim', UNKNOWN_FACT),
    proposedAction: factValue(current, 'requestedAction', UNKNOWN_FACT),
    amountMinor: typeof current.paymentDraft?.amountMinor === 'number' ? current.paymentDraft.amountMinor : null,
    verificationGap: factValue(current, 'verificationStatus', DEFAULT_VERIFICATION_GAP),
    summary: composeSummary(current),
  };
}

/** Hash of the allowlisted content. Keys are constructed in a fixed order by `buildAllowlistedPacket`, so JSON text is stable. */
export function hashAllyPacket(content: AllyPacketContent): string {
  const stable = {
    claim: content.claim,
    proposedAction: content.proposedAction,
    amountMinor: content.amountMinor,
    verificationGap: content.verificationGap,
    summary: content.summary,
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

/** Loads the case and requires `uid` to own it and the case to be unexpired. Non-owner and missing are indistinguishable. */
async function readOwnedCase(db: Firestore, ownerUid: string, caseId: string, now: Now): Promise<AllyReadableCase> {
  const snap = await caseRef(db, caseId).get();
  if (!snap.exists) {
    throw new Error('FORBIDDEN');
  }
  const current = snap.data() as AllyReadableCase;
  if (current.ownerUid !== ownerUid) {
    throw new Error('FORBIDDEN');
  }
  if (current.expiresAt !== undefined && current.expiresAt <= now().toISOString()) {
    throw new Error('EXPIRED');
  }
  return current;
}

async function readPlan(db: Firestore, ownerUid: string): Promise<Plan | undefined> {
  const snap = await db.collection('plans').doc(ownerUid).get();
  return snap.exists ? (snap.data() as Plan) : undefined;
}

/**
 * Owner-only preview of the exact packet an ally would receive. Creates no
 * grant and discloses nothing to any ally; the result binds the later Share
 * to this case version and content hash.
 */
export async function previewAllyPacket(
  db: Firestore,
  ownerUid: string,
  caseId: string,
  now: Now = systemNow,
): Promise<AllyPreview> {
  const current = await readOwnedCase(db, ownerUid, caseId, now);
  const packetContent = buildAllowlistedPacket(current);
  return { caseId, caseVersion: current.version, packetHash: hashAllyPacket(packetContent), packetContent };
}

export interface CreateGrantInput {
  allyUid: string;
  expectedCaseVersion: number;
  expectedPacketHash: string;
}

/**
 * Explicit Share. Rechecks ownership, owner sharing consent, the accepted
 * relationship, the previewed case version, and the packet hash before
 * storing ONLY the allowlisted snapshot. A stale preview must be refreshed
 * (`STALE_PREVIEW`).
 */
export async function createAllyGrant(
  db: Firestore,
  ownerUid: string,
  caseId: string,
  input: CreateGrantInput,
  now: Now = systemNow,
): Promise<Pick<AllyGrant, 'caseId' | 'allyUid' | 'expiresAt' | 'packetHash'>> {
  const current = await readOwnedCase(db, ownerUid, caseId, now);
  const plan = await readPlan(db, ownerUid);
  if (!plan?.allySharingConsent || !(await hasAcceptedRelationship(db, ownerUid, input.allyUid))) {
    throw new Error('FORBIDDEN');
  }
  const packetSnapshot = buildAllowlistedPacket(current);
  const packetHash = hashAllyPacket(packetSnapshot);
  if (current.version !== input.expectedCaseVersion || packetHash !== input.expectedPacketHash) {
    throw new Error('STALE_PREVIEW');
  }

  const ttlEnd = new Date(now().getTime() + GRANT_TTL_MS).toISOString();
  const expiresAt = current.expiresAt !== undefined && current.expiresAt < ttlEnd ? current.expiresAt : ttlEnd;
  const grant: AllyGrant = { caseId, allyUid: input.allyUid, packetSnapshot, packetHash, expiresAt };

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(caseRef(db, caseId));
    if (!fresh.exists || fresh.get('version') !== input.expectedCaseVersion) {
      throw new Error('STALE_PREVIEW');
    }
    tx.set(grantRef(db, caseId, input.allyUid), { ...grant, createdAt: now().toISOString() });
  });
  return { caseId, allyUid: input.allyUid, expiresAt, packetHash };
}

/**
 * Every unrevoked, unexpired case shared with this ally, so the ally window
 * can auto-discover shared cases instead of being told a case id. Lightweight:
 * only the already-allowlisted claim + ids, from the grant snapshots - the
 * full packet read (`readAllyPacket`) still rechecks every predicate on open.
 */
export async function listAllyCases(db: Firestore, allyUid: string, now: Now = systemNow): Promise<AllyGrantedCase[]> {
  const nowIso = now().toISOString();
  const snap = await db.collectionGroup('allyGrants').where('allyUid', '==', allyUid).get();
  const cases: AllyGrantedCase[] = [];
  for (const doc of snap.docs) {
    const grant = doc.data() as AllyGrant;
    if (grant.revokedAt || !grant.packetSnapshot || grant.expiresAt <= nowIso) continue;
    cases.push({ caseId: grant.caseId, claim: grant.packetSnapshot.claim, expiresAt: grant.expiresAt });
  }
  cases.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt) || a.caseId.localeCompare(b.caseId));
  return cases;
}

export const createGrant = createAllyGrant;

/**
 * Owner revokes one ally's grant. Purges the packet snapshot and selection,
 * so a revoked grant retains no case content, and blocks the ally's next
 * request. Idempotent when no grant exists.
 */
export async function revokeGrant(db: Firestore, ownerUid: string, caseId: string, allyUid: string, now: Now = systemNow): Promise<void> {
  await readOwnedCase(db, ownerUid, caseId, now);
  const ref = grantRef(db, caseId, allyUid);
  const snap = await ref.get();
  if (!snap.exists) {
    return;
  }
  await ref.update({ revokedAt: now().toISOString(), packetSnapshot: null });
}

/**
 * Reads the frozen packet. Rechecks ALL predicates on EVERY call - the
 * accepted relationship, the owner's active sharing consent, and an
 * unrevoked, unexpired grant - and never caches authorization. A current
 * allowlisted packet hash that differs from the grant's returns
 * `STALE_GRANT` instead of silently widening or updating access.
 */
export async function readAllyPacket(db: Firestore, allyUid: string, caseId: string, now: Now = systemNow): Promise<AllyPacket> {
  const caseSnap = await caseRef(db, caseId).get();
  if (!caseSnap.exists) {
    throw new Error('FORBIDDEN');
  }
  const current = caseSnap.data() as AllyReadableCase;
  const ownerUid = current.ownerUid;
  const nowIso = now().toISOString();
  if (ownerUid === allyUid || (current.expiresAt !== undefined && current.expiresAt <= nowIso)) {
    throw new Error('FORBIDDEN');
  }

  const plan = await readPlan(db, ownerUid);
  const grantSnap = await grantRef(db, caseId, allyUid).get();
  const grant = grantSnap.exists ? (grantSnap.data() as AllyGrant) : undefined;
  if (
    !plan?.allySharingConsent ||
    !(await hasAcceptedRelationship(db, ownerUid, allyUid)) ||
    !grant ||
    grant.revokedAt ||
    !grant.packetSnapshot ||
    grant.expiresAt <= nowIso
  ) {
    throw new Error('FORBIDDEN');
  }

  const currentContent = buildAllowlistedPacket(current);
  if (hashAllyPacket(currentContent) !== grant.packetHash) {
    throw new Error('STALE_GRANT');
  }
  const { claim, proposedAction, amountMinor, verificationGap, summary } = grant.packetSnapshot;
  return { caseId, expiresAt: grant.expiresAt, claim, proposedAction, amountMinor, verificationGap, summary };
}

const ResponseSchema = z.discriminatedUnion('kind', [
  z.object({ idempotencyKey: z.uuid(), kind: z.literal('contact-request') }).strict(),
  z.object({ idempotencyKey: z.uuid(), kind: z.literal('pause-recommendation') }).strict(),
  z.object({ idempotencyKey: z.uuid(), kind: z.literal('contact-caller') }).strict(),
  z
    .object({ idempotencyKey: z.uuid(), kind: z.literal('checked-source'), source: z.string().trim().min(1).max(500) })
    .strict(),
]);

/**
 * Records an ally response (contact request, pause recommendation, or the
 * independent source they checked). Authorization and packet freshness are
 * rechecked first. A response is advisory data in its own subcollection: it
 * never touches the case projection, payment state, or verification, so the
 * ally has no transfer control and cannot certify the caller.
 */
export async function respondAsAlly(
  db: Firestore,
  allyUid: string,
  caseId: string,
  response: AllyResponse,
  now: Now = systemNow,
): Promise<void> {
  await readAllyPacket(db, allyUid, caseId, now);
  const parsed = ResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new Error('INVALID_RESPONSE');
  }
  const { idempotencyKey, ...rest } = parsed.data;
  const ref = caseRef(db, caseId).collection('allyResponses').doc(`${allyUid}:${idempotencyKey}`);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      const prior = existing.data() as Record<string, unknown>;
      const same = prior.kind === rest.kind && prior.source === ('source' in rest ? rest.source : undefined);
      if (!same) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      return;
    }
    tx.create(ref, { ...rest, caseId, allyUid, createdAt: now().toISOString() });
  });
}
