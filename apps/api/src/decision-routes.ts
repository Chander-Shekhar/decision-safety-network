// Human action console domain and routes (plan Task 7 / DSN-009; PRD C6/C9).
// `act()` is the sole function that may ever move `paymentState` to
// `paused`/`cancelled`/`continued` (payment.ts's own doc comment names this
// module as that exclusive owner). It deliberately never calls `assessCase`:
// pause/cancel/verify/continue are explicit human decisions, not
// policy-derived, so there is no path from `GeminiPort`/model output into
// this function at all - a model response can never issue one of these
// commands. `phase` only ever moves through the shared, pure `transition()`
// table (DSN-007); nothing here reads or writes it any other way.

import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';
import type { CaseCommandResult, CaseReducer } from '@dsn/contracts';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { commitCaseCommand, readCase } from './case-store.js';
import { transition } from './transitions.js';
import type { PaymentProjection } from '../../../packages/contracts/src/payment.js';

/**
 * One explicit, owner-issued decision command. `key` is the idempotency key
 * (mirrors `payment-routes.ts`'s `idempotencyKey`): replaying the same `key`
 * against the same case returns the original receipt rather than re-running
 * the reducer (commitCaseCommand's own guarantee) - no duplicate event, no
 * extra version bump. `continue` is the only kind that carries
 * `acknowledged`; every other kind ignores it.
 */
export type DecisionAction =
  | { kind: 'pause'; key: string; expectedVersion: number }
  | { kind: 'cancel'; key: string; expectedVersion: number }
  | { kind: 'verify'; key: string; expectedVersion: number }
  | { kind: 'continue'; key: string; expectedVersion: number; acknowledged: boolean };

/**
 * Derives a deterministic, RFC-4122-shaped v4 UUID from `seed`.
 * `commitCaseCommand` validates every `idempotencyKey` against `z.uuid()`
 * (version AND variant nibbles, not just the general 8-4-4-4-12 shape - see
 * `case-store.ts`'s `idempotencyKeySchema`), so `actVerify`'s hop-1 key
 * cannot simply be `action.key` with a string suffix appended - that fails
 * the format check outright. Hashing the seed and re-stamping the version/
 * variant nibbles keeps the key deterministic (the same `action.key` always
 * yields the same hop-1 key, which is what makes the hop idempotent and
 * resumable) while still satisfying the schema. Collision with a real
 * `action.key` (itself always a fresh random v4 UUID per `ActionBodySchema`)
 * or with another action's hop-1 key is cryptographically negligible.
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
 * `verify`'s own two-hop-capable path. The canonical transition table
 * (`transitions.ts`) has no direct `Observe -> Verify` pair, so a quiet
 * Observe-only case must legally record `Check` before `Verify` - as TWO
 * individually legal, individually PERSISTED events (`Observe -> Check`,
 * then `Check -> Verify`), never one event whose endpoints span an illegal
 * pair. `Check`/`Pause` already have a direct legal pair to `Verify`, so
 * those stay a single event, exactly as before.
 *
 * Idempotency/OCC across the two hops:
 * - Hop 1's event-doc id is `deterministicUuid(`${action.key}:to-check`)`;
 *   hop 2's is `action.key` itself - the same id a single-hop verify always
 *   used, so a Check/Pause-origin verify (no hop 1 at all) is byte-for-byte
 *   what it always was: one event, under `action.key`, version +1.
 * - This function first peeks whether hop 1's event already exists (mirrors
 *   `payment.ts`'s `recheckRelation` dedup peek). If it does, a PRIOR call
 *   under this exact `action.key` already committed it - either earlier in
 *   this very call, or in a previous attempt that crashed before hop 2 ran.
 *   That event's own stored receipt `version` (always the version
 *   immediately after hop 1, whether freshly computed just now or replayed
 *   from a prior attempt) becomes hop 2's `expectedVersion` - never the
 *   client's original `action.expectedVersion`, which describes the
 *   pre-hop-1 state and would otherwise mismatch the real current version
 *   and throw a spurious `VERSION_CONFLICT` on resume.
 * - If hop 1's event does not exist and the case's current phase actually is
 *   `Observe`, hop 1 is committed fresh at the client-supplied
 *   `expectedVersion` (`Observe -> Check`).
 * - Otherwise (no hop-1 event, non-Observe origin) hop 2 alone runs at the
 *   client-supplied `expectedVersion`, exactly as a single-hop verify always
 *   has.
 * - Hop 2 then commits under `action.key` at whichever `expectedVersion` was
 *   resolved above. If hop 2's event already exists too (a full replay after
 *   both hops previously succeeded), `commitCaseCommand`'s own
 *   idempotency-key-is-event-id check returns the stored receipt before any
 *   version comparison runs, so a full replay is always a no-op regardless
 *   of the `expectedVersion` resolved above.
 *
 * Each hop's reducer independently re-checks `PAYMENT_FINALIZED` against its
 * own fresh, transactionally-read `current` (never a value trusted from
 * outside its own transaction), never calls `assessCase`, and only ever
 * spreads `{...current, phase}` - never naming `paymentState` - so a
 * no-draft case (no `paymentState` field at all) is never given an explicit
 * `undefined` value that `tx.update`'s field-list write would reject.
 */
async function actVerify(
  db: Firestore,
  uid: string,
  caseId: string,
  action: Extract<DecisionAction, { kind: 'verify' }>,
): Promise<PaymentProjection> {
  const hop1Key = deterministicUuid(`${action.key}:to-check`);
  const current = await readCase<PaymentProjection>(db, uid, caseId);
  const hop1Snap = await db.collection('cases').doc(caseId).collection('events').doc(hop1Key).get();

  let hop2ExpectedVersion = action.expectedVersion;

  if (hop1Snap.exists) {
    hop2ExpectedVersion = (hop1Snap.get('result') as CaseCommandResult).version;
  } else if (current.phase === 'Observe') {
    const hop1Reducer: CaseReducer<PaymentProjection> = (c) => {
      if (c.paymentState === 'cancelled' || c.paymentState === 'continued') {
        throw new Error('PAYMENT_FINALIZED');
      }
      return { ...c, phase: transition(c.phase, 'Check', 'verify-request') };
    };
    const hop1Result = await commitCaseCommand(
      db,
      {
        caseId,
        actorUid: uid,
        idempotencyKey: hop1Key,
        expectedVersion: action.expectedVersion,
        kind: 'decision.verify-check-hop',
        payload: {},
      },
      hop1Reducer,
    );
    hop2ExpectedVersion = hop1Result.version;
  }

  const hop2Reducer: CaseReducer<PaymentProjection> = (c) => {
    if (c.paymentState === 'cancelled' || c.paymentState === 'continued') {
      throw new Error('PAYMENT_FINALIZED');
    }
    return { ...c, phase: transition(c.phase, 'Verify', 'verify-request') };
  };
  await commitCaseCommand(
    db,
    {
      caseId,
      actorUid: uid,
      idempotencyKey: action.key,
      expectedVersion: hop2ExpectedVersion,
      kind: 'decision.verify',
      payload: {},
    },
    hop2Reducer,
  );
  return readCase<PaymentProjection>(db, uid, caseId);
}

/**
 * Explicit, owner-authenticated human decision commands: pause, cancel,
 * verify, and acknowledged continue (PRD C6). Routed through
 * `commitCaseCommand` for an idempotent, inspectable, versioned state
 * change - `commitCaseCommand` itself stamps the shared `POLICY_VERSION`
 * (`'cup-core-1'`) on the recorded event, so there is nothing further to
 * record here. `reasons` is never recomputed: every branch (here and in
 * `actVerify` above) returns `current.reasons` untouched, because neither
 * this function nor `actVerify` ever calls `assessCase` (DSN-008's
 * `submitIntent`/`applyValidatedRelation` remain the sole call sites) - a
 * human decision here can change `paymentState`/`phase` but never
 * fabricates a fresh policy justification for doing so.
 *
 * `verify` is delegated to `actVerify`, which may commit one or two events
 * depending on the case's current phase (see its own doc comment);
 * `pause`/`cancel`/`continue` always commit exactly one, as before.
 *
 * Once a payment is finalized (`cancelled`/`continued`), every further
 * action is rejected with `PAYMENT_FINALIZED` (mirrors `payment.ts`'s own
 * guard) - a `paused` payment is not final and can still be
 * cancelled/verified/continued.
 */
export async function act(db: Firestore, uid: string, caseId: string, action: DecisionAction): Promise<PaymentProjection> {
  if (action.kind === 'verify') {
    return actVerify(db, uid, caseId, action);
  }

  const reducer: CaseReducer<PaymentProjection> = (current) => {
    if (current.paymentState === 'cancelled' || current.paymentState === 'continued') {
      throw new Error('PAYMENT_FINALIZED');
    }
    if (action.kind === 'continue' && action.acknowledged !== true) {
      throw new Error('ACK_REQUIRED');
    }

    const phase =
      action.kind === 'cancel' || action.kind === 'continue'
        ? transition(current.phase, 'Resolve', 'explicit-user-decision')
        : current.phase;

    const paymentState = action.kind === 'cancel' ? 'cancelled' : action.kind === 'pause' ? 'paused' : 'continued';
    return { ...current, paymentState, phase };
  };

  await commitCaseCommand(
    db,
    {
      caseId,
      actorUid: uid,
      idempotencyKey: action.key,
      expectedVersion: action.expectedVersion,
      kind: `decision.${action.kind}`,
      payload: action.kind === 'continue' ? { acknowledged: action.acknowledged } : {},
    },
    reducer,
  );
  return readCase<PaymentProjection>(db, uid, caseId);
}

const ActionBodySchema = z.object({ expectedVersion: z.number().int().nonnegative(), idempotencyKey: z.uuid() });
const ContinueBodySchema = ActionBodySchema.extend({ acknowledged: z.boolean() });

/**
 * Domain errors `act` throws that are not already in `app.ts`'s shared
 * vocabulary (FORBIDDEN/VERSION_CONFLICT/... are mapped there). `app.ts` is
 * serialized and not ours to extend, so this module maps these locally and
 * re-throws anything else, mirroring `fact-routes.ts`/`payment-routes.ts`.
 * `ACK_REQUIRED` is a malformed-decision rejection (400); `PAYMENT_FINALIZED`
 * and `ILLEGAL_TRANSITION` are state conflicts (409), matching the sibling
 * `VERSION_CONFLICT` code.
 */
const LOCAL_ERROR_STATUS: Record<string, number> = {
  ACK_REQUIRED: 400,
  PAYMENT_FINALIZED: 409,
  ILLEGAL_TRANSITION: 409,
};

function replyOrRethrow(reply: FastifyReply, error: unknown): undefined {
  if (error instanceof Error && error.message in LOCAL_ERROR_STATUS) {
    reply.code(LOCAL_ERROR_STATUS[error.message]!).send({ error: error.message });
    return undefined;
  }
  throw error;
}

/**
 * Human action console routes (plan Task 7 / DSN-009): idempotent
 * `pause`/`cancel`/`verify`/`continue` commands. Unlike `createFactRoutes`/
 * `createPaymentRoutes`, this module needs no `GeminiPort` - `act` never
 * calls the model. Mounting these routes into the shared public app is
 * deferred to the integrator (Task 12 / DSN-014, per the plan's file map);
 * tests build an isolated app via `buildApi([createDecisionRoutes()], deps)`.
 */
export function createDecisionRoutes(): RouteInstaller {
  return (app, deps: ApiDeps) => {
    app.post('/api/v1/cases/:id/actions/pause', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = ActionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        return await act(deps.db, uid, caseId, { kind: 'pause', key: parsed.data.idempotencyKey, expectedVersion: parsed.data.expectedVersion });
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/actions/cancel', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = ActionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        return await act(deps.db, uid, caseId, { kind: 'cancel', key: parsed.data.idempotencyKey, expectedVersion: parsed.data.expectedVersion });
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/actions/verify', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = ActionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        return await act(deps.db, uid, caseId, { kind: 'verify', key: parsed.data.idempotencyKey, expectedVersion: parsed.data.expectedVersion });
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/actions/continue', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = ContinueBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        return await act(deps.db, uid, caseId, {
          kind: 'continue',
          key: parsed.data.idempotencyKey,
          expectedVersion: parsed.data.expectedVersion,
          acknowledged: parsed.data.acknowledged,
        });
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });
  };
}
