import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { saveDraft, submitIntent, recheckRelation } from './payment.js';
import type { GeminiPort } from '../../../packages/contracts/src/facts.js';

// The browser sends `beneficiaryId`/`amountMinor` only (PRD C4; decision
// 0001) - there is deliberately no `newPayee` or `phase` field on either
// schema below for a client to supply, so a malicious or buggy client has
// no field through which to smuggle a server-owned value.
const SaveDraftBodySchema = z.object({
  beneficiaryId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.uuid(),
});

const SubmitIntentBodySchema = z.object({
  draftId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.uuid(),
});

/**
 * Domain errors `payment.ts` throws that are not the shared `app.ts` error
 * vocabulary (FORBIDDEN/PLAN_REQUIRED/VERSION_CONFLICT/... are already
 * mapped there). `app.ts` is serialized and not ours to extend, so this
 * route module maps these locally and re-throws anything else, mirroring
 * `fact-routes.ts`/`session-routes.ts`.
 */
const LOCAL_ERROR_STATUS: Record<string, number> = {
  INVALID_AMOUNT: 400,
  INVALID_BENEFICIARY: 400,
  STALE_DRAFT: 409,
  PAYMENT_FINALIZED: 409,
  NO_DRAFT: 409,
  CONSENT_REQUIRED: 403,
};

function replyOrRethrow(reply: FastifyReply, error: unknown): undefined {
  if (error instanceof Error && error.message in LOCAL_ERROR_STATUS) {
    reply.code(LOCAL_ERROR_STATUS[error.message]!).send({ error: error.message });
    return undefined;
  }
  throw error;
}

/**
 * Payment simulator routes (plan Task 6 / DSN-008): saving/editing the
 * draft, submitting it as a non-settling pending intent, and the one
 * explicit recheck route. A `GeminiPort` is injected explicitly (mirroring
 * `createFactRoutes`), rather than threaded through the serialized
 * `ApiDeps`, so tests can supply a fake port and real wiring (Task 12) can
 * supply `gemini.ts`'s concrete adapter.
 *
 * `recheck` always fully awaits `recheckRelation` before replying - there is
 * no unawaited background promise anywhere in this path (invariant 5).
 * Human action commands (pause/cancel/verify/continue) are explicitly out of
 * scope here; see DSN-009.
 */
export function createPaymentRoutes(gemini: GeminiPort): RouteInstaller {
  return (app, deps: ApiDeps) => {
    app.post('/api/v1/cases/:id/payment/draft', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = SaveDraftBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        return await saveDraft(deps.db, uid, caseId, parsed.data);
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/payment/submit', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = SubmitIntentBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        return await submitIntent(deps.db, uid, caseId, parsed.data);
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/payment/recheck', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      try {
        const outcome = await recheckRelation(deps.db, uid, caseId, gemini);
        if (outcome.status === 'degraded') {
          return { status: 'degraded' as const };
        }
        return { status: 'ok' as const, projection: outcome.projection };
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });
  };
}
