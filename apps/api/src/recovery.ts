// Same-case "I already paid" recovery (plan Task 10 / DSN-012). No model call
// is made or awaited anywhere in this module: entering Recover and exposing
// the first-hour actions must work while the model is unavailable (PRD C10).
//
// Trust rule: a proposed payment (simulated draft or user-confirmed caller
// request) is only ever a labeled prefill. `confirmed.paidPayment` is written
// by exactly two explicit owner commands (match-prefill / edit-paid-details)
// and never inferred from a draft, a cancelled simulator state, or transcript
// text. Generic fact confirm/correct cannot reach it: fact-validator's
// `assertKnownField` rejects any field outside the eight extracted ones.

import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import type { CaseCommand, CaseReducer } from '@dsn/contracts';
import type {
  BankAction,
  Helpline1930Action,
  PaidField,
  PaidPayment,
  PaymentPrefill,
  RecoveryAcknowledgement,
  RecoveryKnown,
  RecoveryProjection,
  RecoveryState,
} from '../../../packages/contracts/src/recovery.js';
import { commitCaseCommand, readCase } from './case-store.js';
import { transition } from './transitions.js';

const PAID_FIELDS: readonly PaidField[] = ['paidPayee', 'paidAmountMinor', 'transactionTime', 'paymentRail', 'referenceId'];
const KNOWN_FACT_FIELDS = ['claimedIdentity', 'centralClaim', 'requestedAction', 'payee', 'amount', 'deadline'] as const;

const BANK_ACTION: BankAction = { status: 'ready', route: 'Demo Bank', simulated: true };
const HELPLINE_1930_ACTION: Helpline1930Action = {
  status: 'ready',
  route: '1930',
  sourceUrl: 'https://cybercrime.gov.in/',
  reviewedAt: '2026-10-02',
};

// --- Commands ------------------------------------------------------------

const keySchema = z.string();
const versionSchema = z.number().int().nonnegative().optional();
const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).max(100).optional(),
);

const EnterCommandSchema = z.object({ kind: z.literal('already-paid'), key: keySchema, expectedVersion: versionSchema });
const MatchCommandSchema = z.object({
  kind: z.literal('match-prefill'),
  expectedPrefillFingerprint: z.string().min(1),
  transactionTime: optionalText,
  paymentRail: optionalText,
  referenceId: optionalText,
  key: keySchema,
  expectedVersion: versionSchema,
});
const EditCommandSchema = z.object({
  kind: z.literal('edit-paid-details'),
  paidPayee: z.string().trim().min(1).max(200),
  paidAmountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  transactionTime: optionalText,
  paymentRail: optionalText,
  referenceId: optionalText,
  key: keySchema,
  expectedVersion: versionSchema,
});
const AcknowledgementCommandSchema = z.object({
  kind: z.literal('acknowledge-action'),
  action: z.enum(['bank', 'helpline-1930']),
  key: keySchema,
  expectedVersion: versionSchema,
});

export type EnterRecoveryCommand = z.input<typeof EnterCommandSchema>;
export type ConfirmPaidDetailsCommand = z.input<typeof MatchCommandSchema> | z.input<typeof EditCommandSchema>;
export type AcknowledgementCommand = z.input<typeof AcknowledgementCommandSchema>;

// --- Prefill -------------------------------------------------------------

interface StoredFact {
  value?: unknown;
  origin?: unknown;
  sourceSegmentIds?: unknown;
  provenanceLabel?: unknown;
}

function fingerprint(parts: unknown): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/** Minor units only: a plain digit string (optional thousands commas). Anything else is not a complete amount. */
function parseAmountMinor(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function usablePayee(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' || trimmed.toLowerCase() === 'unknown' ? null : trimmed;
}

/** A live fact's source still exists; a retained fact says so itself. */
function sourceStillRetained(fact: StoredFact): boolean {
  return 'provenanceLabel' in fact ? fact.provenanceLabel === 'selected evidence' : true;
}

/**
 * The latest retained simulated draft wins; otherwise user-confirmed
 * caller-request payee+amount, labeled differently (and `source not
 * retained` once raw sources are gone). Returns null unless payee AND amount
 * are both complete, so no one-tap match is ever offered on a partial guess.
 */
export function computePrefill(current: RecoveryProjection): PaymentPrefill | null {
  const draft = current.paymentDraft;
  if (draft) {
    return {
      source: 'simulated-draft',
      sourceLabel: 'Simulated draft',
      sourceRetained: true,
      payee: draft.beneficiaryId,
      amountMinor: draft.amountMinor,
      fingerprint: fingerprint({
        source: 'simulated-draft',
        draftId: draft.id,
        draftVersion: draft.version,
        payee: draft.beneficiaryId,
        amountMinor: draft.amountMinor,
      }),
    };
  }

  const payeeFact = current.confirmed?.payee as StoredFact | undefined;
  const amountFact = current.confirmed?.amount as StoredFact | undefined;
  if (!payeeFact || !amountFact) return null;
  const payee = usablePayee(payeeFact.value);
  const amountMinor = parseAmountMinor(amountFact.value);
  if (payee === null || amountMinor === null) return null;

  const sourceRetained = sourceStillRetained(payeeFact) && sourceStillRetained(amountFact);
  return {
    source: 'caller-request',
    sourceLabel: sourceRetained
      ? 'Caller request (confirmed by you)'
      : 'Caller request (confirmed by you) · source not retained',
    sourceRetained,
    payee,
    amountMinor,
    fingerprint: fingerprint({
      source: 'caller-request',
      payee,
      payeeOrigin: payeeFact.origin ?? null,
      payeeSources: payeeFact.sourceSegmentIds ?? [],
      amountMinor,
      amountOrigin: amountFact.origin ?? null,
      amountSources: amountFact.sourceSegmentIds ?? [],
      sourceRetained,
    }),
  };
}

// --- State ---------------------------------------------------------------

interface StoredPaidPayment {
  payeeId?: unknown;
  amountMinor?: unknown;
  transactionTime?: unknown;
  paymentRail?: unknown;
  referenceId?: unknown;
}

function readPaidPayment(current: RecoveryProjection): PaidPayment | null {
  const stored = (current.confirmed as Record<string, unknown> | undefined)?.paidPayment as StoredPaidPayment | undefined;
  if (!stored || typeof stored.payeeId !== 'string' || typeof stored.amountMinor !== 'number') return null;
  const paid: PaidPayment = { paidPayee: stored.payeeId, paidAmountMinor: stored.amountMinor, origin: 'user-reported' };
  if (typeof stored.transactionTime === 'string') paid.transactionTime = stored.transactionTime;
  if (typeof stored.paymentRail === 'string') paid.paymentRail = stored.paymentRail;
  if (typeof stored.referenceId === 'string') paid.referenceId = stored.referenceId;
  return paid;
}

async function readKnown(db: Firestore, current: RecoveryProjection): Promise<RecoveryKnown> {
  const facts: Record<string, string> = {};
  for (const field of KNOWN_FACT_FIELDS) {
    const fact = current.confirmed?.[field] as StoredFact | undefined;
    if (fact && typeof fact.value === 'string' && fact.value.toLowerCase() !== 'unknown') {
      facts[field] = fact.value;
    }
  }
  const evidence = await db.collection('cases').doc(current.id).collection('evidence').get();
  return { facts, evidenceIds: evidence.docs.map((doc) => doc.id).sort() };
}

async function buildState(db: Firestore, current: RecoveryProjection): Promise<RecoveryState> {
  const paidPayment = readPaidPayment(current);
  const missing = PAID_FIELDS.filter((field) => paidPayment?.[field] == null);
  return {
    caseId: current.id,
    known: await readKnown(db, current),
    proposedPayment: computePrefill(current),
    paidPayment,
    missing,
    bankAction: BANK_ACTION,
    helpline1930Action: HELPLINE_1930_ACTION,
    acknowledgement: current.recoveryAcknowledgement ?? null,
  };
}

/** Reads the owner's recovery state. Throws `NOT_IN_RECOVERY` if the case has not entered Recover. */
export async function readRecoveryState(db: Firestore, uid: string, caseId: string): Promise<RecoveryState> {
  const current = await readCase<RecoveryProjection>(db, uid, caseId);
  if (current.phase !== 'Recover') {
    throw new Error('NOT_IN_RECOVERY');
  }
  return buildState(db, current);
}

// --- Commands ------------------------------------------------------------

function parse<T>(schema: z.ZodType<T>, command: unknown, error: string): T {
  const parsed = schema.safeParse(command);
  if (!parsed.success) {
    throw new Error(error);
  }
  return parsed.data;
}

async function run(
  db: Firestore,
  uid: string,
  caseId: string,
  input: { key: string; expectedVersion?: number | undefined },
  kind: string,
  payload: unknown,
  reducer: CaseReducer<RecoveryProjection>,
): Promise<RecoveryState> {
  // Ownership (FORBIDDEN) is checked before anything else, including the default version.
  const current = await readCase<RecoveryProjection>(db, uid, caseId);
  const command: CaseCommand = {
    caseId,
    actorUid: uid,
    idempotencyKey: input.key,
    expectedVersion: input.expectedVersion ?? current.version,
    kind,
    payload,
  };
  await commitCaseCommand<RecoveryProjection>(db, command, reducer);
  return buildState(db, await readCase<RecoveryProjection>(db, uid, caseId));
}

/**
 * "I already paid": persists one `already-paid` command event and moves the
 * SAME case into Recover through the shared `transition()` (every origin
 * phase has a table-legal edge to Recover). A case already in Recover stays
 * there - a repeat with a new key still records an event but writes no
 * phase edge. Creates no second case and never awaits model work.
 */
export async function enterRecovery(db: Firestore, uid: string, caseId: string, command: EnterRecoveryCommand): Promise<RecoveryState> {
  const parsed = parse(EnterCommandSchema, command, 'INVALID_COMMAND');
  const reducer: CaseReducer<RecoveryProjection> = (current) => ({
    ...current,
    phase: current.phase === 'Recover' ? 'Recover' : transition(current.phase, 'Recover', 'already-paid'),
  });
  return run(db, uid, caseId, parsed, 'already-paid', {}, reducer);
}

/**
 * Records what the owner actually paid as a distinct `confirmed.paidPayment`
 * fact with `user-reported` provenance. `match-prefill` recomputes the
 * current prefill inside the transaction and rejects a fingerprint mismatch
 * (`STALE_PREFILL`) before copying any value; `edit-paid-details` stores only
 * what the owner typed.
 */
export async function confirmPaidDetails(
  db: Firestore,
  uid: string,
  caseId: string,
  command: ConfirmPaidDetailsCommand,
): Promise<RecoveryState> {
  const schema = (command as { kind?: unknown } | null)?.kind === 'match-prefill' ? MatchCommandSchema : EditCommandSchema;
  const parsed = parse<z.output<typeof MatchCommandSchema> | z.output<typeof EditCommandSchema>>(
    schema,
    command,
    'INVALID_PAID_DETAILS',
  );

  const reducer: CaseReducer<RecoveryProjection> = (current) => {
    if (current.phase !== 'Recover') {
      throw new Error('NOT_IN_RECOVERY');
    }
    let payeeId: string;
    let amountMinor: number;
    if (parsed.kind === 'match-prefill') {
      const prefill = computePrefill(current);
      if (prefill === null) {
        throw new Error('NO_PREFILL');
      }
      if (prefill.fingerprint !== parsed.expectedPrefillFingerprint) {
        throw new Error('STALE_PREFILL');
      }
      payeeId = prefill.payee;
      amountMinor = prefill.amountMinor;
    } else {
      payeeId = parsed.paidPayee;
      amountMinor = parsed.paidAmountMinor;
    }
    // Shape matches evidence.ts's `RetainedPaidPayment` so facts-24h retention preserves it.
    const paid: Record<string, unknown> = {
      payeeId,
      amountMinor,
      origin: 'user-reported',
      provenanceLabel: 'source not retained',
      sourceIds: [],
      correctedAt: null,
      reportedAt: new Date().toISOString(),
    };
    for (const optional of ['transactionTime', 'paymentRail', 'referenceId'] as const) {
      if (parsed[optional] !== undefined) paid[optional] = parsed[optional];
    }
    return { ...current, confirmed: { ...current.confirmed, paidPayment: paid as never } };
  };

  const { key: _key, expectedVersion: _expected, ...payload } = parsed;
  return run(db, uid, caseId, parsed, 'paid-details-reported', payload, reducer);
}

/**
 * Records a LOCAL note that the owner contacted the bank or 1930. It is a
 * simulated status only - never proof of an official filing or receipt.
 */
export async function recordAcknowledgement(
  db: Firestore,
  uid: string,
  caseId: string,
  command: AcknowledgementCommand,
): Promise<RecoveryState> {
  const parsed = parse(AcknowledgementCommandSchema, command, 'INVALID_COMMAND');
  const reducer: CaseReducer<RecoveryProjection> = (current) => {
    if (current.phase !== 'Recover') {
      throw new Error('NOT_IN_RECOVERY');
    }
    const acknowledgement: RecoveryAcknowledgement = {
      action: parsed.action,
      status: 'local-note-recorded',
      simulated: true,
      at: new Date().toISOString(),
    };
    return { ...current, recoveryAcknowledgement: acknowledgement };
  };
  return run(db, uid, caseId, parsed, 'recovery-acknowledged', { action: parsed.action }, reducer);
}
