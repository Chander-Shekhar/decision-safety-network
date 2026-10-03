import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase, readCase } from '../src/case-store.js';
import { savePlan } from '../src/plan.js';
import { appendSegment, revokeProcessing } from '../src/session.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { authHeader } from './test-auth.js';
import { saveDraft, submitIntent, recheckRelation, applyValidatedRelation, type RecheckOutcome } from '../src/payment.js';
import { createPaymentRoutes } from '../src/payment-routes.js';
import type { CandidateRelation, GeminiPort, RelateInput } from '../../../packages/contracts/src/facts.js';
import type { PaymentProjection } from '../../../packages/contracts/src/payment.js';

let db: Firestore;
let deps: ApiDeps;

beforeAll(() => {
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-dsn' });
  }
  db = getFirestore();
  deps = { auth: getAuth(), db, now: () => new Date() };
});

function uid(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

/** Saves a plan (processingConsent defaults to true, threshold 500,000 minor units) and creates a fresh case for it, returning the case id. */
async function seedCase(ownerUid: string, thresholdMinor = 500_000, processingConsent = true): Promise<string> {
  await savePlan(db, ownerUid, {
    thresholdMinor,
    bankId: 'demo-bank',
    processingConsent,
    retentionMode: 'facts-24h',
    allySharingConsent: true,
    exportConsent: true,
  });
  const created = await createCase(db, ownerUid, 1);
  return created.id;
}

/** Seeds the (fake, synthetic) beneficiary registry: `payees/{ownerUid}.knownIds`. */
async function seedKnownPayee(ownerUid: string, beneficiaryId: string): Promise<void> {
  await db.collection('payees').doc(ownerUid).set({ knownIds: [beneficiaryId] }, { merge: true });
}

/** Appends one accepted transcript segment directly, bypassing live-processing consent checks that are not this task's concern. */
async function addSegment(ownerUid: string, caseId: string, id: string, order: number, speaker: string, text: string): Promise<number> {
  const result = await appendSegment(db, ownerUid, { id, caseId, order, speaker, text }, () => {});
  return result.caseVersion;
}

/** Marks every one of `relation`'s declared fields as a confirmed match - the "fully joined" relation shape. */
function joinedRelation(partial: Omit<CandidateRelation, 'matches' | 'directedAction'>): CandidateRelation {
  return {
    ...partial,
    directedAction: true,
    matches: [
      { field: 'amountMinor', matches: true, sourceSegmentIds: partial.segmentIds },
      { field: 'beneficiaryId', matches: true, sourceSegmentIds: partial.segmentIds },
    ],
  };
}

/** A `GeminiPort` whose `extract` is never exercised by this task's tests - only `relate` is. */
function unusedExtract(): never {
  throw new Error('extract is not exercised by DSN-008 tests');
}

async function readProjection(ownerUid: string, caseId: string): Promise<PaymentProjection> {
  return readCase<PaymentProjection>(db, ownerUid, caseId);
}

describe('saveDraft (server-owned trust boundary)', () => {
  it('derives newPayee from the server-side payee history, never trusting a client-supplied value', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);

    const unknownPayeeDraft = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'new-payee-1',
      amountMinor: 50_000,
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    });
    expect(unknownPayeeDraft.paymentDraft?.newPayee).toBe(true);

    await seedKnownPayee(ownerUid, 'known-payee-1');
    const knownPayeeDraft = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'known-payee-1',
      amountMinor: 50_000,
      expectedVersion: unknownPayeeDraft.version,
      idempotencyKey: randomUUID(),
    });
    expect(knownPayeeDraft.paymentDraft?.newPayee).toBe(false);
  });

  it('rejects a non-positive amount', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    await expect(
      saveDraft(db, ownerUid, caseId, { beneficiaryId: 'p1', amountMinor: 0, expectedVersion: 0, idempotencyKey: randomUUID() }),
    ).rejects.toThrow('INVALID_AMOUNT');
    await expect(
      saveDraft(db, ownerUid, caseId, { beneficiaryId: 'p1', amountMinor: -1, expectedVersion: 0, idempotencyKey: randomUUID() }),
    ).rejects.toThrow('INVALID_AMOUNT');
  });

  it('rejects a malformed beneficiary id', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    await expect(
      saveDraft(db, ownerUid, caseId, { beneficiaryId: '', amountMinor: 1000, expectedVersion: 0, idempotencyKey: randomUUID() }),
    ).rejects.toThrow('INVALID_BENEFICIARY');
  });

  it('every edit creates a new immutable draft id and increments draft version', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const d1 = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 1000,
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    });
    const d2 = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 2000,
      expectedVersion: d1.version,
      idempotencyKey: randomUUID(),
    });
    expect(d2.paymentDraft?.id).not.toBe(d1.paymentDraft?.id);
    expect(d2.paymentDraft?.version).toBe((d1.paymentDraft?.version ?? 0) + 1);
  });
});

describe('submitIntent (never settles)', () => {
  it('always lands pending, never any settled/held/reversed state, regardless of conversation signals', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid, 10_000);
    const draft = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 50_000,
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    });

    const pending = await submitIntent(db, ownerUid, caseId, {
      draftId: draft.paymentDraft!.id,
      expectedVersion: draft.version,
      idempotencyKey: randomUUID(),
    });

    expect(pending.paymentState).toBe('pending');
    expect(['Observe', 'Check']).toContain(pending.phase);
  });

  it('payment-only (no manipulation cues at all) never advances past Observe at submit', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid, 10_000);
    const draft = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 50_000,
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    });
    const pending = await submitIntent(db, ownerUid, caseId, {
      draftId: draft.paymentDraft!.id,
      expectedVersion: draft.version,
      idempotencyKey: randomUUID(),
    });
    expect(pending.phase).toBe('Observe');
    expect(pending.paymentState).toBe('pending');
  });

  it('conversation cues present at submit time move phase to Check, never straight to Pause', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid, 10_000);
    await addSegment(ownerUid, caseId, 's1', 1, 'caller', 'This is urgent, you must act now.');
    const { correctFact } = await import('../src/fact-validator.js');
    const afterTactics = await readProjection(ownerUid, caseId);
    await correctFact(db, ownerUid, caseId, 'observedTactics', 'urgency-pressure', afterTactics.version);
    const current = await readProjection(ownerUid, caseId);

    const draft = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 50_000,
      expectedVersion: current.version,
      idempotencyKey: randomUUID(),
    });
    const pending = await submitIntent(db, ownerUid, caseId, {
      draftId: draft.paymentDraft!.id,
      expectedVersion: draft.version,
      idempotencyKey: randomUUID(),
    });

    expect(pending.phase).toBe('Check');
    expect(pending.paymentState).toBe('pending');
  });

  it('a stale draftId is rejected', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const d1 = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 1000,
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    });
    const d2 = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 2000,
      expectedVersion: d1.version,
      idempotencyKey: randomUUID(),
    });
    // Correct current version, but a draftId from before the edit above.
    await expect(
      submitIntent(db, ownerUid, caseId, { draftId: d1.paymentDraft!.id, expectedVersion: d2.version, idempotencyKey: randomUUID() }),
    ).rejects.toThrow('STALE_DRAFT');
  });

  it('duplicate submit (same idempotencyKey) replays the original receipt rather than re-running', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const draft = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 1000,
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    });
    const key = randomUUID();
    const first = await submitIntent(db, ownerUid, caseId, { draftId: draft.paymentDraft!.id, expectedVersion: draft.version, idempotencyKey: key });
    const second = await submitIntent(db, ownerUid, caseId, { draftId: draft.paymentDraft!.id, expectedVersion: draft.version, idempotencyKey: key });
    expect(second.version).toBe(first.version);
  });
});

describe('applyValidatedRelation (joined intervention requires a validated, current, source-grounded relation)', () => {
  async function seedJoinedCase(ownerUid: string) {
    const caseId = await seedCase(ownerUid, 10_000);
    const v1 = await addSegment(ownerUid, caseId, 's1', 1, 'caller', 'This is urgent, pay now.');
    const afterTactics = await readProjection(ownerUid, caseId);
    const { correctFact } = await import('../src/fact-validator.js');
    await correctFact(db, ownerUid, caseId, 'observedTactics', 'urgency-pressure', afterTactics.version);
    const afterCorrect = await readProjection(ownerUid, caseId);

    const draft = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 50_000,
      expectedVersion: afterCorrect.version,
      idempotencyKey: randomUUID(),
    });
    const pending = await submitIntent(db, ownerUid, caseId, {
      draftId: draft.paymentDraft!.id,
      expectedVersion: draft.version,
      idempotencyKey: randomUUID(),
    });
    return { caseId, pending, draft, v1 };
  }

  it('amount alone, or conversation alone, never produces a joined Pause', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending, draft } = await seedJoinedCase(ownerUid);

    const amountOnly: CandidateRelation = {
      segmentIds: ['s1'],
      draftEventId: draft.paymentDraft!.id,
      draftVersion: draft.paymentDraft!.version,
      inputCaseVersion: pending.version,
      directedAction: true,
      matches: [
        { field: 'amountMinor', matches: true, sourceSegmentIds: ['s1'] },
        { field: 'beneficiaryId', matches: false, sourceSegmentIds: [] },
      ],
    };
    const afterAmountOnly = await applyValidatedRelation(db, caseId, amountOnly);
    expect(afterAmountOnly.phase).not.toBe('Pause');

    const conversationOnly: CandidateRelation = {
      segmentIds: ['s1'],
      draftEventId: draft.paymentDraft!.id,
      draftVersion: draft.paymentDraft!.version,
      inputCaseVersion: afterAmountOnly.version,
      directedAction: false,
      matches: [
        { field: 'amountMinor', matches: false, sourceSegmentIds: [] },
        { field: 'beneficiaryId', matches: false, sourceSegmentIds: [] },
      ],
    };
    const afterConversationOnly = await applyValidatedRelation(db, caseId, conversationOnly);
    expect(afterConversationOnly.phase).not.toBe('Pause');
  });

  it('a fully joined, current, source-grounded relation advances a pending case to Pause', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending, draft } = await seedJoinedCase(ownerUid);

    const relation = joinedRelation({
      segmentIds: ['s1'],
      draftEventId: draft.paymentDraft!.id,
      draftVersion: draft.paymentDraft!.version,
      inputCaseVersion: pending.version,
    });
    const result = await applyValidatedRelation(db, caseId, relation);

    expect(result.phase).toBe('Pause');
    expect(result.paymentState).toBe('pending');
    expect(result.reasons.some((r) => r.code === 'large-new-payee')).toBe(true);
  });

  it('a draft edit invalidates any prior relation (stale draftEventId/draftVersion is discarded, not applied)', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending, draft } = await seedJoinedCase(ownerUid);

    const staleRelation = joinedRelation({
      segmentIds: ['s1'],
      draftEventId: draft.paymentDraft!.id,
      draftVersion: draft.paymentDraft!.version,
      inputCaseVersion: pending.version,
    });

    // Edit the draft after submit - a materially new proposal, invalidating the above relation.
    await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 90_000,
      expectedVersion: pending.version,
      idempotencyKey: randomUUID(),
    });

    const result = await applyValidatedRelation(db, caseId, staleRelation);
    expect(result.phase).not.toBe('Pause');
  });

  it('a relation citing a segment id not present on the current case is discarded (fabricated citation)', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending, draft } = await seedJoinedCase(ownerUid);

    const fabricated = joinedRelation({
      segmentIds: ['ghost-segment'],
      draftEventId: draft.paymentDraft!.id,
      draftVersion: draft.paymentDraft!.version,
      inputCaseVersion: pending.version,
    });
    const result = await applyValidatedRelation(db, caseId, fabricated);
    expect(result.phase).not.toBe('Pause');
  });

  it('a stale inputCaseVersion (pre-submit result arriving late) is discarded, never promoted', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid, 10_000);
    const draft = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 50_000,
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    });
    const preSubmitVersion = draft.version;

    const pending = await submitIntent(db, ownerUid, caseId, {
      draftId: draft.paymentDraft!.id,
      expectedVersion: draft.version,
      idempotencyKey: randomUUID(),
    });

    const staleResult = joinedRelation({
      segmentIds: [],
      draftEventId: draft.paymentDraft!.id,
      draftVersion: draft.paymentDraft!.version,
      inputCaseVersion: preSubmitVersion,
    });
    const result = await applyValidatedRelation(db, caseId, staleResult);
    expect(result.version).toBe(pending.version);
    expect(result.phase).not.toBe('Pause');
  });
});

describe('recheckRelation (bounded, deduplicated, consent-gated)', () => {
  function fakeGemini(relate: (input: RelateInput) => Promise<CandidateRelation>): GeminiPort {
    return { extract: unusedExtract, relate };
  }

  async function seedPendingCase(ownerUid: string) {
    const caseId = await seedCase(ownerUid, 10_000);
    await addSegment(ownerUid, caseId, 's1', 1, 'caller', 'This is urgent, pay now.');
    const afterTactics = await readProjection(ownerUid, caseId);
    const { correctFact } = await import('../src/fact-validator.js');
    await correctFact(db, ownerUid, caseId, 'observedTactics', 'urgency-pressure', afterTactics.version);
    const afterCorrect = await readProjection(ownerUid, caseId);

    const draft = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 50_000,
      expectedVersion: afterCorrect.version,
      idempotencyKey: randomUUID(),
    });
    const pending = await submitIntent(db, ownerUid, caseId, {
      draftId: draft.paymentDraft!.id,
      expectedVersion: draft.version,
      idempotencyKey: randomUUID(),
    });
    return { caseId, pending, draft };
  }

  it('a current, fully joined relate() result advances the pending case to Pause', async () => {
    const ownerUid = uid('owner');
    const { caseId, pending, draft } = await seedPendingCase(ownerUid);

    const gemini = fakeGemini(async (input) =>
      joinedRelation({
        segmentIds: ['s1'],
        draftEventId: input.draftEventId,
        draftVersion: input.draftVersion,
        inputCaseVersion: input.inputCaseVersion,
      }),
    );

    const outcome: RecheckOutcome = await recheckRelation(db, ownerUid, caseId, gemini);
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') {
      expect(outcome.projection.phase).toBe('Pause');
    }
    void draft;
    void pending;
  });

  it('race: the draft changes between relate() being called and its result arriving - never auto-settles or fabricates Pause', async () => {
    const ownerUid = uid('owner');
    const { caseId, draft } = await seedPendingCase(ownerUid);

    let capturedInput: RelateInput | undefined;
    const gemini = fakeGemini(async (input) => {
      capturedInput = input;
      // Simulate the draft changing while the model call is in flight.
      await saveDraft(db, ownerUid, caseId, {
        beneficiaryId: 'p1',
        amountMinor: 77_000,
        expectedVersion: (await readProjection(ownerUid, caseId)).version,
        idempotencyKey: randomUUID(),
      });
      return joinedRelation({
        segmentIds: ['s1'],
        draftEventId: input.draftEventId,
        draftVersion: input.draftVersion,
        inputCaseVersion: input.inputCaseVersion,
      });
    });

    const outcome = await recheckRelation(db, ownerUid, caseId, gemini);
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') {
      expect(outcome.projection.phase).not.toBe('Pause');
      expect(outcome.projection.paymentState).toBe('pending');
    }
    expect(capturedInput?.draftEventId).toBe(draft.paymentDraft!.id);
  });

  it('race: a late decisive segment arrives while relate() is in flight - the now-stale result is discarded, never fabricating Pause', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedPendingCase(ownerUid);

    const gemini = fakeGemini(async (input) => {
      // A new, decisive segment is accepted after relate() was called with
      // the previous segment/version snapshot, but before its result lands.
      await addSegment(ownerUid, caseId, 's2', 2, 'caller', 'Send it to p1 right now.');
      return joinedRelation({
        segmentIds: input.segments.map((s) => s.id),
        draftEventId: input.draftEventId,
        draftVersion: input.draftVersion,
        inputCaseVersion: input.inputCaseVersion,
      });
    });

    const outcome = await recheckRelation(db, ownerUid, caseId, gemini);
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') {
      // The result's inputCaseVersion no longer matches the case (the new
      // segment bumped it), so it is discarded rather than promoted.
      expect(outcome.projection.phase).not.toBe('Pause');
      expect(outcome.projection.paymentState).toBe('pending');
    }
  });

  it('Gemini timeout keeps the case pending in Check, never settles, and reports degraded', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedPendingCase(ownerUid);
    const neverResolves: GeminiPort = {
      extract: unusedExtract,
      relate: () => new Promise(() => {}),
    };

    const outcome = await recheckRelation(db, ownerUid, caseId, neverResolves, { timeoutMs: 50 });
    expect(outcome.status).toBe('degraded');

    const after = await readProjection(ownerUid, caseId);
    expect(after.paymentState).toBe('pending');
    expect(after.phase).not.toBe('Pause');
  });

  it('model outage (relate always rejects) keeps the case pending, never settles, and reports degraded', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedPendingCase(ownerUid);
    const alwaysFails = fakeGemini(async () => {
      throw new Error('MODEL_OUTAGE');
    });

    const outcome = await recheckRelation(db, ownerUid, caseId, alwaysFails);
    expect(outcome.status).toBe('degraded');
    const after = await readProjection(ownerUid, caseId);
    expect(after.paymentState).toBe('pending');
  });

  it('deduplicates repeated recheck calls for the same (case, version, draft): relate() is called at most once', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedPendingCase(ownerUid);
    let calls = 0;
    // A non-matching relation leaves `phase` unchanged (still `Check`), so
    // the case version does not move between the two calls below - this is
    // what makes them genuinely the same (case, version, draft) attempt,
    // rather than the second call legitimately targeting a new version.
    const gemini = fakeGemini(async (input) => {
      calls += 1;
      return {
        segmentIds: ['s1'],
        draftEventId: input.draftEventId,
        draftVersion: input.draftVersion,
        inputCaseVersion: input.inputCaseVersion,
        directedAction: false,
        matches: [
          { field: 'amountMinor', matches: false, sourceSegmentIds: [] },
          { field: 'beneficiaryId', matches: false, sourceSegmentIds: [] },
        ],
      };
    });

    await recheckRelation(db, ownerUid, caseId, gemini);
    await recheckRelation(db, ownerUid, caseId, gemini);
    expect(calls).toBe(1);
  });

  it('is gated on processing consent: a revoked/closed session never calls relate() and never pauses', async () => {
    const ownerUid = uid('owner');
    const { caseId } = await seedPendingCase(ownerUid);
    await revokeProcessing(db, ownerUid, caseId);

    let called = false;
    const gemini = fakeGemini(async (input) => {
      called = true;
      return joinedRelation({
        segmentIds: ['s1'],
        draftEventId: input.draftEventId,
        draftVersion: input.draftVersion,
        inputCaseVersion: input.inputCaseVersion,
      });
    });

    await expect(recheckRelation(db, ownerUid, caseId, gemini)).rejects.toThrow('CONSENT_REQUIRED');
    expect(called).toBe(false);
  });
});

describe('POST /api/v1/cases/:id/payment/recheck (authenticated route)', () => {
  function fakeGemini(relate: (input: RelateInput) => Promise<CandidateRelation>): GeminiPort {
    return { extract: unusedExtract, relate };
  }

  it('rejects an unauthenticated request', async () => {
    const app = buildApi([createPaymentRoutes(fakeGemini(unusedExtract as never))], deps);
    const response = await app.inject({ method: 'POST', url: '/api/v1/cases/some-case/payment/recheck' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a non-owner with FORBIDDEN', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid, 10_000);
    await saveDraft(db, ownerUid, caseId, { beneficiaryId: 'p1', amountMinor: 1000, expectedVersion: 0, idempotencyKey: randomUUID() });

    const other = uid('other');
    const app = buildApi([createPaymentRoutes(fakeGemini(unusedExtract as never))], deps);
    const headers = await authHeader(other);
    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/payment/recheck`, headers });
    expect(response.statusCode).toBe(403);
  });

  it('returns the joined Pause result for the owner through the real authenticated route', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid, 10_000);
    await addSegment(ownerUid, caseId, 's1', 1, 'caller', 'This is urgent, pay now.');
    const afterTactics = await readProjection(ownerUid, caseId);
    const { correctFact } = await import('../src/fact-validator.js');
    await correctFact(db, ownerUid, caseId, 'observedTactics', 'urgency-pressure', afterTactics.version);
    const afterCorrect = await readProjection(ownerUid, caseId);

    const draft = await saveDraft(db, ownerUid, caseId, {
      beneficiaryId: 'p1',
      amountMinor: 50_000,
      expectedVersion: afterCorrect.version,
      idempotencyKey: randomUUID(),
    });
    await submitIntent(db, ownerUid, caseId, { draftId: draft.paymentDraft!.id, expectedVersion: draft.version, idempotencyKey: randomUUID() });

    const gemini = fakeGemini(async (input) =>
      joinedRelation({
        segmentIds: ['s1'],
        draftEventId: input.draftEventId,
        draftVersion: input.draftVersion,
        inputCaseVersion: input.inputCaseVersion,
      }),
    );
    const app = buildApi([createPaymentRoutes(gemini)], deps);
    const headers = await authHeader(ownerUid);
    const response = await app.inject({ method: 'POST', url: `/api/v1/cases/${caseId}/payment/recheck`, headers });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; projection?: PaymentProjection };
    expect(body.status).toBe('ok');
    expect(body.projection?.phase).toBe('Pause');
  });
});
