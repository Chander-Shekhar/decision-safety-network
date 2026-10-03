// Payment simulator / cross-context bind / non-settling submit (plan Task 6
// / DSN-008). Decision 0001: nothing in this file ever settles a transfer -
// `submitIntent` only ever produces `paymentState: 'pending'`, and no
// function here ever writes `paused`/`cancelled`/`continued` (DSN-009's
// `act()` owns those explicit human-decision transitions exclusively).
//
// This module is the only call site of `assessCase`/`transition` for the
// payment surface: it is responsible for deriving the conversation-side
// signals `assessCase` needs (reading only `FactsProjection.confirmed`, per
// that module's own documented trust boundary - never raw `facts`) and for
// independently re-validating a `CandidateRelation` against the *current*
// case state before ever treating it as a match, even though `gemini.ts`'s
// adapter already performs its own staleness check (`STALE_RELATION`) - a
// caller must never rely solely on the model adapter's self-report.

import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { CaseCommandResult, CaseReducer } from '@dsn/contracts';
import type { CandidateRelation, FactSegmentInput, GeminiPort, RelateInput } from '../../../packages/contracts/src/facts.js';
import type { Fact, FactsProjection } from '../../../packages/contracts/src/facts.js';
import type { PaymentDraft, PaymentProjection, PaymentReason } from '../../../packages/contracts/src/payment.js';
import { commitCaseCommand, readCase } from './case-store.js';
import { assessCase, POLICY_VERSION, type AssessCaseInput } from './policy.js';
import { transition } from './transitions.js';

type FullProjection = PaymentProjection & FactsProjection & { sessionClosed?: boolean };

// --- Server-owned trust boundary -----------------------------------------
// The browser sends `beneficiaryId`/`amountMinor` only (enforced by
// `payment-routes.ts`'s request schema, which simply has no `newPayee` or
// `phase` field to carry a client-supplied value through). Everything below
// is derived or validated server-side.

const BENEFICIARY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/i;

function isValidBeneficiaryId(id: unknown): id is string {
  return typeof id === 'string' && BENEFICIARY_ID_PATTERN.test(id);
}

/**
 * Server-owned payee history: has `ownerUid` already paid `beneficiaryId`
 * before this case? Read-only here - nothing in this task's scope ever
 * writes to it, since no payment this prototype produces ever actually
 * settles (decision 0001). Demo/test fixtures seed it directly in Firestore
 * at `payees/{ownerUid}.knownIds` (a synthetic, fake registry - there is no
 * real bank integration).
 */
async function isKnownPayee(db: Firestore, ownerUid: string, beneficiaryId: string): Promise<boolean> {
  const snap = await db.collection('payees').doc(ownerUid).get();
  if (!snap.exists) {
    return false;
  }
  const knownIds = (snap.get('knownIds') as string[] | undefined) ?? [];
  return knownIds.includes(beneficiaryId);
}

async function readThresholdMinor(db: Firestore, ownerUid: string): Promise<number> {
  const snap = await db.collection('plans').doc(ownerUid).get();
  if (!snap.exists) {
    throw new Error('PLAN_REQUIRED');
  }
  return snap.get('thresholdMinor') as number;
}

/** This module's own snapshot read of the case's currently-persisted ordered transcript segments, shaped for `GeminiPort.relate`. */
async function readOrderedSegmentIds(db: Firestore, caseId: string): Promise<FactSegmentInput[]> {
  const snap = await db.collection('cases').doc(caseId).collection('segments').get();
  const segments = snap.docs.map((doc) => doc.data() as { id: string; order: number; speaker: string; text: string });
  segments.sort((a, b) => a.order - b.order);
  return segments.map(({ id, speaker, text }) => ({ id, speaker, text }));
}

// --- Conversation-signal derivation (reads only `confirmed`, per facts.ts) --

/**
 * Derives the two conversation-side signals `assessCase` needs, reading
 * ONLY the case's `confirmed` facts (facts.ts's documented trust boundary:
 * an unconfirmed, model-only claim can never by itself drive a joined
 * Pause). `unverified` is hardcoded `true`: no independent verification
 * capability exists yet in this build (plan Task 8/DSN-010 is not started),
 * so every claim is unverified by definition until that capability lands
 * and supplies its own typed, source/method/timestamp-bearing result. This
 * module deliberately never infers "verified" from the free-text
 * `verificationStatus` claim content itself - doing so would let a
 * caller-supplied claim mark itself verified (PRD 8.2's untrusted-
 * transcript rule).
 */
function deriveConversationSignals(confirmed: Record<string, Fact> | undefined): {
  cues: boolean;
  unverified: boolean;
  sourceSegmentIds: string[];
} {
  const tactics = confirmed?.observedTactics;
  const claim = confirmed?.centralClaim;
  const cues = Boolean(tactics && tactics.value !== 'unknown');
  const sourceSegmentIds = [...new Set([...(tactics?.sourceSegmentIds ?? []), ...(claim?.sourceSegmentIds ?? [])])];
  return { cues, unverified: true, sourceSegmentIds };
}

function isLargeNewPayee(draft: PaymentDraft, thresholdMinor: number): boolean {
  return draft.newPayee && draft.amountMinor >= thresholdMinor;
}

/** True only if `relation.directedAction` and every declared field (`amountMinor`, `beneficiaryId`) actually matches - never amount alone or conversation alone (PRD C4). */
function relationConfirms(relation: CandidateRelation): boolean {
  if (!relation.directedAction) {
    return false;
  }
  const byField = new Map(relation.matches.map((m) => [m.field, m]));
  return Boolean(byField.get('amountMinor')?.matches) && Boolean(byField.get('beneficiaryId')?.matches);
}

/**
 * True only if `relation` is still bound to the *current* draft and case
 * version, and cites only segments that actually exist on the current case
 * (defense in depth against a fabricated/dangling citation, mirroring
 * `fact-validator.ts`'s "drop fabricated citation" rule) - independent of
 * `gemini.ts`'s own `STALE_RELATION` self-check.
 */
function isCurrentRelation(relation: CandidateRelation, current: PaymentProjection): boolean {
  if (!current.paymentDraft) {
    return false;
  }
  return (
    relation.draftEventId === current.paymentDraft.id &&
    relation.draftVersion === current.paymentDraft.version &&
    relation.inputCaseVersion === current.version &&
    relation.segmentIds.every((id) => current.segmentIds.includes(id))
  );
}

function sourceSegmentsFromRelation(relation: CandidateRelation): string[] {
  return [...new Set(relation.matches.flatMap((m) => m.sourceSegmentIds))];
}

// --- Draft lifecycle --------------------------------------------------------

export interface SaveDraftInput {
  beneficiaryId: string;
  amountMinor: number;
  expectedVersion: number;
  idempotencyKey: string;
}

/**
 * Saves (creates, or edits/replaces) the case's open payment draft.
 * `newPayee` is always server-derived here, never accepted from the caller.
 * Every call - including an edit of an already-submitted pending draft -
 * mints a brand new immutable draft `id` and increments `version`,
 * invalidating any previously validated `CandidateRelation` outright (its
 * `draftEventId`/`draftVersion` can never match again). Editing a
 * `paused`/`cancelled`/`continued` payment (an explicit human decision
 * already recorded by DSN-009) is rejected.
 */
export async function saveDraft(db: Firestore, uid: string, caseId: string, input: SaveDraftInput): Promise<PaymentProjection> {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('INVALID_AMOUNT');
  }
  if (!isValidBeneficiaryId(input.beneficiaryId)) {
    throw new Error('INVALID_BENEFICIARY');
  }

  const alreadyKnown = await isKnownPayee(db, uid, input.beneficiaryId);
  const knownSegmentIds = (await readOrderedSegmentIds(db, caseId)).map((s) => s.id);
  const draftId = randomUUID();

  const reducer: CaseReducer<FullProjection> = (current) => {
    if (current.paymentState === 'paused' || current.paymentState === 'cancelled' || current.paymentState === 'continued') {
      throw new Error('PAYMENT_FINALIZED');
    }
    const nextDraftVersion = (current.paymentDraft?.version ?? 0) + 1;
    const draft: PaymentDraft = {
      id: draftId,
      beneficiaryId: input.beneficiaryId,
      amountMinor: input.amountMinor,
      newPayee: !alreadyKnown,
      version: nextDraftVersion,
    };
    // Editing an already-submitted (pending) draft must not silently un-pend
    // it - invariant 4 requires a changed draft to keep the payment pending,
    // never fabricate a quiet "back to draft" state the owner never chose.
    // The new immutable draft id/version still invalidates any prior
    // relation outright; only a first-ever save (no submission yet) sets
    // `draft`.
    const nextPaymentState = current.paymentState === 'pending' ? 'pending' : 'draft';
    return { ...current, paymentDraft: draft, paymentState: nextPaymentState, segmentIds: knownSegmentIds };
  };

  await commitCaseCommand(
    db,
    {
      caseId,
      actorUid: uid,
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.expectedVersion,
      kind: 'payment.draft-saved',
      payload: { beneficiaryId: input.beneficiaryId, amountMinor: input.amountMinor },
    },
    reducer,
  );
  return readCase<PaymentProjection>(db, uid, caseId);
}

export interface SubmitIntentInput {
  draftId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

/**
 * Submits the current draft as a pending payment intent. This is the whole
 * of "submit": it only ever sets `paymentState: 'pending'` and advances
 * `phase` through a legal `transition()` driven by `assessCase` - nothing
 * here, or reachable from here, ever marks a transfer complete, held, or
 * reversed (decision 0001). Because the case `version` always bumps as part
 * of this very command, no relation evaluated *before* this call can ever
 * be current afterward (its `inputCaseVersion` can never match the new
 * version) - so submission alone can never directly reach `Pause`; a joined
 * Pause can only be reached by a *subsequent* `recheckRelation`/
 * `applyValidatedRelation` call against the fresh post-submit version.
 */
export async function submitIntent(db: Firestore, uid: string, caseId: string, input: SubmitIntentInput): Promise<PaymentProjection> {
  const thresholdMinor = await readThresholdMinor(db, uid);

  const reducer: CaseReducer<FullProjection> = (current) => {
    const draft = current.paymentDraft;
    if (!draft || draft.id !== input.draftId) {
      throw new Error('STALE_DRAFT');
    }
    if (current.paymentState === 'paused' || current.paymentState === 'cancelled' || current.paymentState === 'continued') {
      throw new Error('PAYMENT_FINALIZED');
    }

    const signals = deriveConversationSignals(current.confirmed);
    const largeNewPayee = isLargeNewPayee(draft, thresholdMinor);
    const assessInput: AssessCaseInput = {
      cues: signals.cues,
      unverified: signals.unverified,
      matchingRelation: false,
      largeNewPayee,
      sourceSegmentIds: signals.sourceSegmentIds,
    };
    const decision = assessCase(assessInput);
    const nextPhase = decision.phase === current.phase ? current.phase : transition(current.phase, decision.phase, 'payment-submit-intent');

    return { ...current, paymentState: 'pending', phase: nextPhase, reasons: toPaymentReasons(decision.reasons) };
  };

  await commitCaseCommand(
    db,
    {
      caseId,
      actorUid: uid,
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.expectedVersion,
      kind: 'payment.submit-intent',
      payload: { draftId: input.draftId },
    },
    reducer,
  );
  return readCase<PaymentProjection>(db, uid, caseId);
}

function toPaymentReasons(reasons: ReturnType<typeof assessCase>['reasons']): PaymentReason[] {
  return reasons.map((r) => ({
    code: r.code,
    text: r.text,
    sourceSegmentIds: r.sourceSegmentIds,
    ...(r.paymentEventId ? { paymentEventId: r.paymentEventId } : {}),
    ...(r.correctionEventId ? { correctionEventId: r.correctionEventId } : {}),
  }));
}

// --- Relation application ---------------------------------------------------

interface ApplyOptions {
  eventId?: string;
  knownSegmentIds?: string[];
}

/**
 * Applies one `CandidateRelation` to the case, re-validating it independently
 * against the case's *current* state before treating it as a match
 * (`isCurrentRelation`/`relationConfirms`) - never trusting the model
 * adapter's own `STALE_RELATION` self-check alone. A stale, foreign, or
 * fabricated-citation relation is silently discarded (no phase change, no
 * version bump) rather than throwing: a race is not an error, it is simply
 * "nothing to apply yet". `paymentState` is never touched here - only
 * `phase`, via a legal `transition()`.
 *
 * Idempotent per `options.eventId` (defaults to a fresh id for direct/test
 * callers): a repeat call with the same `eventId` replays without
 * re-evaluating, which is what lets `recheckRelation` deduplicate per
 * (case, version, draft) by passing a deterministic id.
 */
export async function applyValidatedRelation(
  db: Firestore,
  caseId: string,
  relation: CandidateRelation,
  options: ApplyOptions = {},
): Promise<PaymentProjection> {
  const eventId = options.eventId ?? randomUUID();
  const preSnap = await db.collection('cases').doc(caseId).get();
  if (!preSnap.exists) {
    throw new Error('FORBIDDEN');
  }
  const ownerUid = (preSnap.data() as PaymentProjection).ownerUid;
  const thresholdMinor = await readThresholdMinor(db, ownerUid);

  return db.runTransaction(async (tx) => {
    const caseRef = db.collection('cases').doc(caseId);
    const eventRef = caseRef.collection('events').doc(eventId);

    const snap = await tx.get(caseRef);
    if (!snap.exists) {
      throw new Error('FORBIDDEN');
    }
    const current = snap.data() as FullProjection;

    const eventSnap = await tx.get(eventRef);
    if (eventSnap.exists) {
      return current;
    }

    const effectiveSegmentIds = options.knownSegmentIds ?? current.segmentIds ?? [];
    const checkable: PaymentProjection = { ...current, segmentIds: effectiveSegmentIds };
    const now = new Date().toISOString();

    if (!isCurrentRelation(relation, checkable)) {
      if (options.knownSegmentIds) {
        tx.update(caseRef, { segmentIds: effectiveSegmentIds, updatedAt: now });
      }
      tx.create(eventRef, discardedEvent(eventId, caseId, current, now));
      return options.knownSegmentIds ? { ...current, segmentIds: effectiveSegmentIds } : current;
    }

    const matchingRelation = relationConfirms(relation);
    const signals = deriveConversationSignals(current.confirmed);
    const largeNewPayee = isLargeNewPayee(current.paymentDraft!, thresholdMinor);
    const assessInput: AssessCaseInput = {
      cues: signals.cues,
      unverified: signals.unverified,
      matchingRelation,
      largeNewPayee,
      sourceSegmentIds: [...new Set([...signals.sourceSegmentIds, ...sourceSegmentsFromRelation(relation)])],
      paymentEventId: current.paymentDraft?.id,
    };
    const decision = assessCase(assessInput);
    const nextPhase = decision.phase === current.phase ? current.phase : transition(current.phase, decision.phase, 'payment-relation-applied');
    // Persist the same `reasons` value being returned on both branches below -
    // Firestore `update` with an explicit field list merges rather than
    // replacing, so omitting `reasons` here would leave a fresh read's
    // persisted reasons stale against the (possibly new) `phase` (DSN-008 B1).
    const reasons = toPaymentReasons(decision.reasons);

    if (nextPhase === current.phase) {
      tx.update(caseRef, { segmentIds: effectiveSegmentIds, updatedAt: now, reasons });
      tx.create(eventRef, rechecked(eventId, caseId, current, now));
      return { ...current, segmentIds: effectiveSegmentIds, reasons };
    }

    const nextVersion = current.version + 1;
    const next: PaymentProjection = {
      ...current,
      phase: nextPhase,
      version: nextVersion,
      updatedAt: now,
      segmentIds: effectiveSegmentIds,
      reasons,
    };
    tx.update(caseRef, { phase: nextPhase, version: nextVersion, updatedAt: now, segmentIds: effectiveSegmentIds, reasons });
    tx.create(eventRef, {
      id: eventId,
      caseId,
      actorUid: current.ownerUid,
      kind: 'payment.relation-applied',
      at: now,
      causationId: eventId,
      policyVersion: POLICY_VERSION,
      // Mirrors fact-validator.ts's `[...changedFields, ...citedSegmentIds]`
      // convention: reason codes are metadata, carried in `refs` alongside
      // the segments they cite, without widening the shared `CaseEvent` type.
      refs: [...decision.reasons.map((r) => r.code), ...decision.reasons.flatMap((r) => r.sourceSegmentIds)],
      result: { id: current.id, version: nextVersion, phase: nextPhase } satisfies CaseCommandResult,
    });
    return next;
  });
}

function discardedEvent(eventId: string, caseId: string, current: FullProjection, now: string) {
  return {
    id: eventId,
    caseId,
    actorUid: current.ownerUid,
    kind: 'payment.relation-discarded',
    at: now,
    causationId: eventId,
    policyVersion: POLICY_VERSION,
    refs: [],
    result: { id: current.id, version: current.version, phase: current.phase } satisfies CaseCommandResult,
  };
}

function rechecked(eventId: string, caseId: string, current: FullProjection, now: string) {
  return {
    id: eventId,
    caseId,
    actorUid: current.ownerUid,
    kind: 'payment.relation-rechecked',
    at: now,
    causationId: eventId,
    policyVersion: POLICY_VERSION,
    refs: [],
    result: { id: current.id, version: current.version, phase: current.phase } satisfies CaseCommandResult,
  };
}

// --- Recheck orchestration (bounded + deduplicated + consent-gated) --------

const DEFAULT_RELATE_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Bounded call with exactly one retry, mirroring `fact-validator.ts`'s `extractWithRetry`. A second failure degrades rather than throwing - a live recheck being impaired must never block manual controls. */
async function relateWithRetry(gemini: GeminiPort, input: RelateInput, timeoutMs: number): Promise<CandidateRelation | 'degraded'> {
  try {
    return await withTimeout(gemini.relate(input), timeoutMs);
  } catch {
    try {
      return await withTimeout(gemini.relate(input), timeoutMs);
    } catch {
      return 'degraded';
    }
  }
}

export type RecheckOutcome = { status: 'ok'; projection: PaymentProjection } | { status: 'degraded' };

export interface RecheckOptions {
  timeoutMs?: number;
}

async function readProjectionUnchecked(db: Firestore, caseId: string): Promise<PaymentProjection> {
  const snap = await db.collection('cases').doc(caseId).get();
  if (!snap.exists) {
    throw new Error('FORBIDDEN');
  }
  return snap.data() as PaymentProjection;
}

/**
 * Triggers one fresh `GeminiPort.relate` pass over the case's current draft
 * and ordered segments, then applies the result through
 * `applyValidatedRelation`. Ownership and processing consent (reusing the
 * session's own `sessionClosed` semantics - DSN-005) are checked BEFORE any
 * segment read or model call, mirroring decision 0004's rule for
 * `extractFacts`/`assertExtractionAuthorized`: a non-owner or a
 * consent-revoked case triggers zero segment reads and zero model calls.
 *
 * Deduplicated per (case, version, draft): the dedup key is a deterministic
 * event id (`recheck-{version}-{draftId}-{draftVersion}`); a repeat call for
 * the same key short-circuits to the current projection without calling the
 * model again. Fully awaited end to end - there is no unawaited background
 * promise anywhere in this path.
 */
export async function recheckRelation(
  db: Firestore,
  uid: string,
  caseId: string,
  gemini: GeminiPort,
  options: RecheckOptions = {},
): Promise<RecheckOutcome> {
  const preSnap = await db.collection('cases').doc(caseId).get();
  if (!preSnap.exists) {
    throw new Error('FORBIDDEN');
  }
  const pre = preSnap.data() as FullProjection;
  if (pre.ownerUid !== uid) {
    throw new Error('FORBIDDEN');
  }
  if (pre.sessionClosed) {
    throw new Error('CONSENT_REQUIRED');
  }
  if (!pre.paymentDraft) {
    throw new Error('NO_DRAFT');
  }

  const draft = pre.paymentDraft;
  const inputCaseVersion = pre.version;
  const eventId = `recheck-${inputCaseVersion}-${draft.id}-${draft.version}`;

  const dedupSnap = await db.collection('cases').doc(caseId).collection('events').doc(eventId).get();
  if (dedupSnap.exists) {
    return { status: 'ok', projection: await readProjectionUnchecked(db, caseId) };
  }

  const segments = await readOrderedSegmentIds(db, caseId);
  const knownSegmentIds = segments.map((s) => s.id);
  const timeoutMs = options.timeoutMs ?? DEFAULT_RELATE_TIMEOUT_MS;

  const relateInput: RelateInput = {
    segments,
    draftEventId: draft.id,
    draftVersion: draft.version,
    inputCaseVersion,
    amountMinor: draft.amountMinor,
    beneficiaryId: draft.beneficiaryId,
  };

  const relateResult = await relateWithRetry(gemini, relateInput, timeoutMs);
  if (relateResult === 'degraded') {
    return { status: 'degraded' };
  }

  const projection = await applyValidatedRelation(db, caseId, relateResult, { eventId, knownSegmentIds });
  return { status: 'ok', projection };
}
