// Pre-pickup caller screening (PRD C2, DSN-024). Combines an untrusted
// third-party caller-ID signal with the owner's private confirmed-fraud list
// into a calm verdict.
//
// Trust boundary, enforced here and not in the UI:
//  - The adapter's return is re-normalized field by field; no provider text
//    (names, "verified" flags, numbers, URLs) is ever copied into a verdict.
//  - The verdict is constructed with `officialRoute: null` and
//    `certifiesCaller: false`; there is no input that changes either.
//  - Screening never writes the fraud list. Only `addConfirmedFraud` does.

import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { normalizePlan, type CallListeningMode, type Plan } from '../../../packages/contracts/src/plan.js';
import type {
  CallerIdCategory,
  CallerIdSignal,
  ListeningDecision,
  ScreeningLevel,
  ScreeningVerdict,
} from '../../../packages/contracts/src/screening.js';
import { isOnFraudList, maskNumber, normalizeNumber } from './fraud-list.js';
import type { CallerIdAdapter } from './screening-adapter.js';

const CATEGORIES: readonly CallerIdCategory[] = ['spam-reported', 'unknown', 'no-signal'];

/** Re-builds a signal from only the known, typed fields. Anything else the provider sent is dropped. */
export function sanitizeSignal(raw: unknown): CallerIdSignal {
  const candidate = (raw ?? {}) as { category?: unknown; reportCount?: unknown };
  const category = CATEGORIES.find((c) => c === candidate.category) ?? 'no-signal';
  const signal: CallerIdSignal = { category };
  if (category === 'spam-reported' && typeof candidate.reportCount === 'number' && Number.isSafeInteger(candidate.reportCount) && candidate.reportCount >= 0) {
    signal.reportCount = candidate.reportCount;
  }
  return signal;
}

/**
 * `all-calls` listens; `per-call` asks at pickup. `unverified-only` listens
 * too: nothing a third-party signal says can mark a caller verified, so every
 * number is unverified until the owner's own checks say otherwise.
 */
export function listeningFor(mode: CallListeningMode): ListeningDecision {
  return mode === 'per-call' ? 'ask' : 'listen';
}

const COPY: Record<ScreeningLevel, { headline: string | null; detail: string | null }> = {
  none: { headline: null, detail: null },
  unverified: {
    headline: 'Unverified caller',
    detail: "We can't confirm who this is. If you weren't expecting a call, you can let it ring or answer with protection on.",
  },
  'previously-reported': {
    headline: 'Previously reported by you',
    detail: 'You confirmed an earlier call from this number as a scam. You do not have to answer.',
  },
};

export type ScreenOutcome = { ok: true; verdict: ScreeningVerdict } | { ok: false; error: 'INVALID_NUMBER' };

/** Screens an incoming number for `ownerUid`. A failing adapter degrades to "no signal"; the private list still applies. */
export async function screenCall(
  db: Firestore,
  adapter: CallerIdAdapter,
  ownerUid: string,
  rawNumber: string,
  options: { caseId?: string } = {},
): Promise<ScreenOutcome> {
  const normalized = normalizeNumber(rawNumber);
  if (!normalized) return { ok: false, error: 'INVALID_NUMBER' };

  let signal: CallerIdSignal;
  try {
    signal = sanitizeSignal(await adapter.lookup(normalized));
  } catch {
    signal = { category: 'no-signal' };
  }
  const previouslyReported = await isOnFraudList(db, ownerUid, normalized);

  const planSnap = await db.collection('plans').doc(ownerUid).get();
  const plan: Plan | null = planSnap.exists ? normalizePlan(planSnap.data() as Plan) : null;

  const level: ScreeningLevel = previouslyReported
    ? 'previously-reported'
    : signal.category === 'no-signal'
      ? 'none'
      : 'unverified';
  const copy = COPY[level];
  const detail =
    level === 'unverified' && signal.category === 'spam-reported' && copy.detail
      ? `Other people have flagged this number. ${copy.detail}`
      : copy.detail;

  const verdict: ScreeningVerdict = {
    level,
    warn: level !== 'none',
    maskedNumber: maskNumber(normalized),
    headline: copy.headline,
    detail,
    previouslyReported,
    signal,
    listening: listeningFor(plan?.callListening ?? 'per-call'),
    trust: 'untrusted',
    simulated: true,
    officialRoute: null,
    certifiesCaller: false,
  };

  if (options.caseId) {
    await recordSignalOnCase(db, ownerUid, options.caseId, verdict);
  }
  return { ok: true, verdict };
}

/** Stores the signal on the owner's case as labeled untrusted evidence. Never stores the raw number. */
async function recordSignalOnCase(db: Firestore, ownerUid: string, caseId: string, verdict: ScreeningVerdict): Promise<void> {
  const caseRef = db.collection('cases').doc(caseId);
  const caseSnap = await caseRef.get();
  if (!caseSnap.exists || caseSnap.get('ownerUid') !== ownerUid) {
    throw new Error('FORBIDDEN');
  }
  await caseRef.collection('screeningSignals').doc(randomUUID()).set({
    trust: 'untrusted',
    simulated: true,
    maskedNumber: verdict.maskedNumber,
    signal: verdict.signal,
    level: verdict.level,
    officialRoute: null,
    certifiesCaller: false,
    recordedAt: new Date().toISOString(),
  });
}
