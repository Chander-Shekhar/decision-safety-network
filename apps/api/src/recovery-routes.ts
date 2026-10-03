import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { confirmPaidDetails, enterRecovery, readRecoveryState, recordAcknowledgement } from './recovery.js';

// There is deliberately no phase, proposed-payment, or paidPayment field a
// client could supply: the server derives the prefill and phase; the browser
// may only send an explicit match (with the fingerprint it saw) or its own
// typed paid details.
const EnterBodySchema = z.object({
  expectedVersion: z.number().int().nonnegative().optional(),
  idempotencyKey: z.uuid(),
});

const optionalText = z.string().optional();

const PaidDetailsBodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('match-prefill'),
    expectedPrefillFingerprint: z.string().min(1),
    transactionTime: optionalText,
    paymentRail: optionalText,
    referenceId: optionalText,
    expectedVersion: z.number().int().nonnegative().optional(),
    idempotencyKey: z.uuid(),
  }),
  z.object({
    kind: z.literal('edit-paid-details'),
    paidPayee: z.string().min(1),
    paidAmountMinor: z.number().int().positive(),
    transactionTime: optionalText,
    paymentRail: optionalText,
    referenceId: optionalText,
    expectedVersion: z.number().int().nonnegative().optional(),
    idempotencyKey: z.uuid(),
  }),
]);

const AcknowledgementBodySchema = z.object({
  action: z.enum(['bank', 'helpline-1930']),
  expectedVersion: z.number().int().nonnegative().optional(),
  idempotencyKey: z.uuid(),
});

/**
 * Domain errors `recovery.ts` throws that are not the shared `app.ts` error
 * vocabulary. `app.ts` is serialized, so they are mapped locally (mirrors
 * `payment-routes.ts`). All are state conflicts (409) except malformed input.
 */
const LOCAL_ERROR_STATUS: Record<string, number> = {
  STALE_PREFILL: 409,
  NO_PREFILL: 409,
  NOT_IN_RECOVERY: 409,
  INVALID_PAID_DETAILS: 400,
  INVALID_COMMAND: 400,
};

function replyOrRethrow(reply: FastifyReply, error: unknown): undefined {
  if (error instanceof Error && error.message in LOCAL_ERROR_STATUS) {
    reply.code(LOCAL_ERROR_STATUS[error.message]!).send({ error: error.message });
    return undefined;
  }
  throw error;
}

/**
 * Same-case already-paid recovery routes (plan Task 10 / DSN-012). No
 * `GeminiPort` is accepted: entering Recover and exposing the first-hour
 * actions never depends on the model. Mounting into the public app is
 * deferred to DSN-014.
 */
export function createRecoveryRoutes(): RouteInstaller {
  return (app, deps: ApiDeps) => {
    app.post('/api/v1/cases/:id/recovery/enter', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = EnterBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        return await enterRecovery(deps.db, uid, caseId, {
          kind: 'already-paid',
          key: parsed.data.idempotencyKey,
          expectedVersion: parsed.data.expectedVersion,
        });
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.get('/api/v1/cases/:id/recovery', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      try {
        return await readRecoveryState(deps.db, uid, caseId);
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/recovery/paid-details', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = PaidDetailsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      const { idempotencyKey, ...rest } = parsed.data;
      try {
        return await confirmPaidDetails(deps.db, uid, caseId, { ...rest, key: idempotencyKey });
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/recovery/acknowledgement', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = AcknowledgementBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        return await recordAcknowledgement(deps.db, uid, caseId, {
          kind: 'acknowledge-action',
          action: parsed.data.action,
          key: parsed.data.idempotencyKey,
          expectedVersion: parsed.data.expectedVersion,
        });
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });
  };
}
