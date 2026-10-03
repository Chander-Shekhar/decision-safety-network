// Completed simulated Demo Bank verification workflow (plan Task 8 /
// DSN-010; PRD C7/C9). `verifyWithDemoBank` is the sole function that may
// ever produce a `VerificationResult`, and it launches ONLY from the
// versioned `DEMO_BANK_REGISTRY` - this module never reads a caller/
// transcript-supplied phone number, callback, URL, or route at all (there is
// no such parameter on its signature; `verification-routes.ts` rejects any
// such field at the request boundary, before this function is ever called).
// No model/Gemini output can reach this module either - nothing here takes
// a `GeminiPort`, mirroring `decision-routes.ts`'s own exclusion of the
// model from explicit human/system decision commands.
//
// `phase` only ever advances through the shared, pure `transition()` table
// (DSN-007); this module never writes `phase` any other way. Resolving the
// case (reaching `Resolve`) is still DSN-009's `act()` (cancel/continue) -
// this module only ever moves a Check/Pause/Verify-phase case to `Verify`
// and records the result; it never calls `act` and never sets
// `paymentState` itself.

import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { CaseEnvelope, CaseReducer } from '@dsn/contracts';
import type { PaymentState } from '../../../packages/contracts/src/payment.js';
import { commitCaseCommand, readCase } from './case-store.js';
import { transition } from './transitions.js';
import { DEMO_BANK_REGISTRY } from './demo-bank-registry.js';

/**
 * One completed, provenance-bearing simulated verification. Every field is
 * either a fixed registry fact or a server-derived timestamp/outcome - never
 * caller-supplied, never model-authored, and `simulated` is asserted `true`
 * in the type itself so no caller of this module can present it as a real
 * bank response (PRD "every external bank... response is persistently
 * labeled Simulated").
 */
export interface VerificationResult {
  bankId: 'demo-bank';
  registryVersion: string;
  method: 'versioned-demo-registry';
  checkedAt: string;
  outboundFraudCall: boolean;
  protectedTransferRequested: boolean;
  simulated: true;
}

/** The case projection fields this feature adds on top of the foundation `CaseEnvelope` (mirrors `payment.ts`'s `PaymentProjection` doc-comment convention). */
export interface VerificationProjection extends CaseEnvelope {
  verification?: VerificationResult;
  paymentState?: PaymentState;
}

/**
 * Deterministic, RFC-4122-shaped v4 UUID derived from `seed`, so the same
 * `caseId` always yields the same idempotency key for this one-shot
 * workflow. Mirrors `decision-routes.ts`'s own `deterministicUuid` (not
 * exported there, and that module is serialized/off-limits to this task, so
 * this is a small, independently-justified duplicate rather than a shared
 * import): `commitCaseCommand` validates every `idempotencyKey` against
 * `z.uuid()` (version AND variant nibbles), so a plain hash digest or a
 * caller-suffixed string would fail that format check outright.
 */
function deterministicUuid(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex');
  const variantNibble = ((parseInt(hex[15], 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(12, 15)}`,
    `${variantNibble}${hex.slice(16, 19)}`,
    hex.slice(19, 31),
  ].join('-');
}

/**
 * Runs the completed, simulated Demo Bank verification workflow for
 * `caseId` on behalf of its owner `uid`, and durably records the result on
 * the case. Requires the owner's own saved plan to name the registry's own
 * bank id (`UNKNOWN_BANK` otherwise) - defense in depth alongside
 * `plan-routes.ts`'s `z.literal('demo-bank')`, since this module must never
 * assume a Firestore-level plan document actually matches its declared
 * type.
 *
 * Ownership is checked first (via `readCase`, which throws `FORBIDDEN` for
 * a non-owner or nonexistent case before this function reads anything
 * plan-related), mirroring `case-store.ts`'s own documented ordering.
 *
 * Idempotent per case: a deterministic idempotency key derived from
 * `caseId` alone means a second call for a case that already has a result
 * safely short-circuits to the stored result without re-deriving a new
 * `checkedAt` or bumping the case version again - this is a one-shot
 * workflow, not a repeatable recheck. The early return below is an
 * optimization only (mirrors `payment.ts`'s `recheckRelation` dedup peek);
 * `commitCaseCommand`'s own deterministic-key dedup guarantees the same
 * outcome even under a concurrent race, since both callers' transactions
 * resolve against the same event document id.
 *
 * `phase` only ever moves to `Verify` through the shared `transition()`
 * table: a case in `Check` or `Pause` legally advances; a case already in
 * `Verify` is left as-is (no self-transition is attempted); a case in
 * `Observe`, `Recover`, or `Resolve` has no legal edge to `Verify` at all,
 * so `transition()` itself throws `ILLEGAL_TRANSITION` - there is no
 * separate phase allowlist to maintain here.
 */
export async function verifyWithDemoBank(db: Firestore, caseId: string, uid: string): Promise<VerificationResult> {
  const current = await readCase<VerificationProjection>(db, uid, caseId);
  if (current.verification) {
    return current.verification;
  }

  const planSnap = await db.collection('plans').doc(uid).get();
  if (!planSnap.exists) {
    throw new Error('PLAN_REQUIRED');
  }
  if (planSnap.get('bankId') !== DEMO_BANK_REGISTRY.id) {
    throw new Error('UNKNOWN_BANK');
  }

  const result: VerificationResult = {
    bankId: DEMO_BANK_REGISTRY.id,
    registryVersion: DEMO_BANK_REGISTRY.version,
    method: 'versioned-demo-registry',
    checkedAt: new Date().toISOString(),
    outboundFraudCall: false,
    protectedTransferRequested: false,
    simulated: true,
  };

  const idempotencyKey = deterministicUuid(`verify-demo-bank:${caseId}`);
  const reducer: CaseReducer<VerificationProjection> = (c) => {
    if (c.verification) {
      return c;
    }
    const phase = c.phase === 'Verify' ? c.phase : transition(c.phase, 'Verify', 'demo-bank-verification');
    return { ...c, phase, verification: result };
  };

  await commitCaseCommand(
    db,
    { caseId, actorUid: uid, idempotencyKey, expectedVersion: current.version, kind: 'verification.demo-bank', payload: {} },
    reducer,
  );

  const persisted = await readCase<VerificationProjection>(db, uid, caseId);
  return persisted.verification ?? result;
}
