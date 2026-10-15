import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { createPlan, normalizePlan, type AllyInvitation, type CreatePlanInput, type Plan } from '../../../packages/contracts/src/plan.js';
import { consumePairingCode } from './ally-pairing.js';

type SavePlanInput = Omit<CreatePlanInput, 'ownerUid' | 'version' | 'nominatedAllyUid' | 'setupCompletedAt'> & {
  /** Marks first-run setup complete; the server stamps `setupCompletedAt` (kept once set). */
  completeSetup?: boolean;
};

/** Reads the owner's plan normalized to the current contract (v1 documents get v2 defaults), or null if none. */
export async function getPlan(db: Firestore, ownerUid: string): Promise<Plan | null> {
  const snap = await db.collection('plans').doc(ownerUid).get();
  return snap.exists ? normalizePlan(snap.data() as Plan) : null;
}

/**
 * Saves (creates or fully replaces) the owner's Safety Plan: threshold,
 * Demo Bank route, and the four separate consents. Each save increments
 * `version`. `nominatedAllyUid` is intentionally left out of `input`'s type
 * and is never touched here - it's managed solely by `createInvitation`, so
 * an ordinary plan-details save can never silently clobber an existing ally
 * nomination.
 */
export async function savePlan(db: Firestore, ownerUid: string, input: SavePlanInput): Promise<Plan> {
  const ref = db.collection('plans').doc(ownerUid);
  const existing = await ref.get();
  const nextVersion = existing.exists ? (existing.get('version') as number) + 1 : 1;
  // Carry forward any existing ally nomination into the returned Plan (and
  // the merge-write below is then a no-op for that field) so a plan-details
  // save never appears, to its own caller, to have dropped the nomination.
  const existingNominatedAllyUid = existing.exists ? (existing.get('nominatedAllyUid') as string | undefined) : undefined;
  // v2 fields omitted by the caller (e.g. the legacy plan-edit form) keep their stored values.
  const prior = existing.exists ? normalizePlan(existing.data() as Plan) : undefined;
  const { completeSetup, ...fields } = input;
  const setupCompletedAt = prior?.setupCompletedAt ?? (completeSetup ? new Date().toISOString() : undefined);
  const plan = createPlan({
    ...fields,
    callListening: fields.callListening ?? prior?.callListening,
    allyShareFields: fields.allyShareFields ?? prior?.allyShareFields,
    bankAccounts: fields.bankAccounts ?? prior?.bankAccounts,
    ...(setupCompletedAt !== undefined ? { setupCompletedAt } : {}),
    ownerUid,
    version: nextVersion,
    ...(existingNominatedAllyUid !== undefined ? { nominatedAllyUid: existingNominatedAllyUid } : {}),
  });
  await ref.set(plan, { merge: true });
  return plan;
}

/**
 * Redeems a pairing code to create a detail-free invitation from `ownerUid`
 * to the code's bound ally, and records that nomination on the owner's
 * plan. Requires the owner to already have a saved plan (consistent with
 * `apps/api/src/case-store.ts`'s existing `PLAN_REQUIRED` boundary) so this
 * never creates a malformed partial plan document.
 *
 * Enforces a single-active-ally invariant: at most one non-revoked
 * invitation per owner at a time. Re-nominating (a different ally, or even
 * the same one) first revokes every existing non-revoked invitation for
 * `ownerUid`, so a stale accepted invitation can never keep granting
 * `hasAcceptedRelationship` to an ally who is no longer the current
 * nomination. Revocation only happens after `consumePairingCode` succeeds,
 * so an invalid code never revokes the prior (still-valid) invitation.
 */
export async function createInvitation(db: Firestore, ownerUid: string, pairingCode: string): Promise<AllyInvitation> {
  const planRef = db.collection('plans').doc(ownerUid);
  const planSnap = await planRef.get();
  if (!planSnap.exists) {
    throw new Error('PLAN_REQUIRED');
  }
  const allyUid = await consumePairingCode(db, ownerUid, pairingCode);

  const priorActive = await db
    .collection('allyInvitations')
    .where('ownerUid', '==', ownerUid)
    .where('revokedAt', '==', null)
    .get();
  const revokedAt = new Date().toISOString();
  await Promise.all(priorActive.docs.map((doc) => doc.ref.update({ revokedAt })));

  const ref = db.collection('allyInvitations').doc(randomUUID());
  const invitation: AllyInvitation = { id: ref.id, ownerUid, allyUid, acceptedAt: null, revokedAt: null };
  await ref.create(invitation);
  await planRef.set({ nominatedAllyUid: allyUid }, { merge: true });
  return invitation;
}

/**
 * Accepts an invitation. Only the nominated ally (the authenticated
 * `allyUid` must match the invitation's bound ally) may accept; a revoked
 * invitation can never be accepted. Idempotent: accepting twice keeps the
 * original `acceptedAt`.
 */
export async function acceptInvitation(db: Firestore, invitationId: string, allyUid: string): Promise<AllyInvitation> {
  const ref = db.collection('allyInvitations').doc(invitationId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error('NOT_FOUND');
    }
    const data = snap.data() as AllyInvitation;
    if (data.allyUid !== allyUid) {
      throw new Error('FORBIDDEN');
    }
    if (data.revokedAt) {
      throw new Error('FORBIDDEN');
    }
    const acceptedAt = data.acceptedAt ?? new Date().toISOString();
    tx.update(ref, { acceptedAt });
    return { ...data, acceptedAt };
  });
}

/**
 * Revokes an invitation. Only the owner who created it may revoke. Writes a
 * timestamp (never leaves the field unset) so `hasAcceptedRelationship`'s
 * `revokedAt == null` query excludes it starting with the very next read.
 */
export async function revokeInvitation(db: Firestore, invitationId: string, ownerUid: string): Promise<AllyInvitation> {
  const ref = db.collection('allyInvitations').doc(invitationId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error('NOT_FOUND');
    }
    const data = snap.data() as AllyInvitation;
    if (data.ownerUid !== ownerUid) {
      throw new Error('FORBIDDEN');
    }
    const revokedAt = new Date().toISOString();
    tx.update(ref, { revokedAt });
    return { ...data, revokedAt };
  });
}

/**
 * Lists the authenticated ally's own currently-active (unrevoked) invitations.
 * This is the only ally-keyed read of the invitation collection and the one
 * way the ally side of pairing works: an ally never learns an invitation's id
 * from the owner, so until this query returns it, the ally has nothing to
 * accept. Scoped strictly to `allyUid` (never the owner), and returns the
 * detail-free invitation records only - they carry no case data.
 */
export async function listInvitationsForAlly(db: Firestore, allyUid: string): Promise<AllyInvitation[]> {
  const snap = await db
    .collection('allyInvitations')
    .where('allyUid', '==', allyUid)
    .where('revokedAt', '==', null)
    .get();
  return snap.docs.map((d) => d.data() as AllyInvitation);
}

/**
 * Lists the authenticated owner's own currently-active (unrevoked) invitations.
 * The owner-side mirror of `listInvitationsForAlly`: it is how the owner screen
 * learns that the ally it nominated has accepted. The owner already knows the
 * invitation exists (they created it), but acceptance is written by the ally on
 * a separate device/context, so without re-reading this the owner would sit at
 * "awaiting acceptance" forever. Scoped strictly to `ownerUid`, detail-free.
 */
export async function listInvitationsForOwner(db: Firestore, ownerUid: string): Promise<AllyInvitation[]> {
  const snap = await db
    .collection('allyInvitations')
    .where('ownerUid', '==', ownerUid)
    .where('revokedAt', '==', null)
    .get();
  return snap.docs.map((d) => d.data() as AllyInvitation);
}

/**
 * The readiness predicate: true only if `ownerUid` and `allyUid` have a
 * currently-active (unrevoked) invitation that has been accepted. Never
 * caches between calls - every call re-queries Firestore, so revocation
 * takes effect on the very next request.
 */
export async function hasAcceptedRelationship(db: Firestore, ownerUid: string, allyUid: string): Promise<boolean> {
  const snap = await db
    .collection('allyInvitations')
    .where('ownerUid', '==', ownerUid)
    .where('allyUid', '==', allyUid)
    .where('revokedAt', '==', null)
    .get();
  return snap.docs.some((d) => Boolean(d.get('acceptedAt')));
}
