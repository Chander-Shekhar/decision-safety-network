// Human action console domain and routes (plan Task 7 / DSN-009; PRD C6/C9).
// `act()` is the sole function that may ever move `paymentState` to
// `paused`/`cancelled`/`continued` (payment.ts's own doc comment names this
// module as that exclusive owner). It deliberately never calls `assessCase`:
// pause/cancel/verify/continue are explicit human decisions, not
// policy-derived, so there is no path from `GeminiPort`/model output into
// this function at all - a model response can never issue one of these
// commands. `phase` only ever moves through the shared, pure `transition()`
// table (DSN-007); nothing here reads or writes it any other way.

import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';
import type { CaseReducer, Phase } from '@dsn/contracts';
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
 * `verify`'s phase target. The canonical table (`transitions.ts`) has no
 * direct `Observe -> Verify` pair, so a quiet Observe-only case first legally
 * records `Check` before `Verify` - two chained legal hops collapsed into the
 * one committed event, never an illegal direct jump. `Check`/`Pause` go
 * straight to `Verify`.
 */
function verifyPhase(current: Phase): Phase {
  const checked = current === 'Observe' ? transition(current, 'Check', 'verify-request') : current;
  return transition(checked, 'Verify', 'verify-request');
}

/**
 * Explicit, owner-authenticated human decision commands: pause, cancel,
 * verify, and acknowledged continue (PRD C6). Routed through
 * `commitCaseCommand` for an idempotent, inspectable, versioned state
 * change - `commitCaseCommand` itself stamps the shared `POLICY_VERSION`
 * (`'cup-core-1'`) on the recorded event, so there is nothing further to
 * record here. `reasons` is never recomputed: every branch below returns
 * `current.reasons` untouched, because this function never calls
 * `assessCase` (DSN-008's `submitIntent`/`applyValidatedRelation` remain the
 * sole call sites) - a human decision here can change `paymentState`/`phase`
 * but never fabricates a fresh policy justification for doing so.
 *
 * Once a payment is finalized (`cancelled`/`continued`), every further
 * action is rejected with `PAYMENT_FINALIZED` (mirrors `payment.ts`'s own
 * guard) - a `paused` payment is not final and can still be
 * cancelled/verified/continued.
 */
export async function act(db: Firestore, uid: string, caseId: string, action: DecisionAction): Promise<PaymentProjection> {
  const reducer: CaseReducer<PaymentProjection> = (current) => {
    if (current.paymentState === 'cancelled' || current.paymentState === 'continued') {
      throw new Error('PAYMENT_FINALIZED');
    }
    if (action.kind === 'continue' && action.acknowledged !== true) {
      throw new Error('ACK_REQUIRED');
    }

    const phase =
      action.kind === 'verify'
        ? verifyPhase(current.phase)
        : action.kind === 'cancel' || action.kind === 'continue'
          ? transition(current.phase, 'Resolve', 'explicit-user-decision')
          : current.phase;

    // `verify` is the only kind that never changes `paymentState`. Spreading
    // `current` alone (rather than also assigning `paymentState:
    // current.paymentState`) matters for a case with no payment draft yet
    // (quiet verification offered before any transfer is open, PRD causal
    // matrix row 1): such a case's stored document has no `paymentState`
    // field at all, and `tx.update`'s field-list write rejects an explicit
    // `undefined` value - so this must never materialize the key when there
    // is nothing to carry forward. Every other kind always assigns a
    // concrete, defined value, so this concern never arises for them.
    if (action.kind === 'verify') {
      return { ...current, phase };
    }
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
