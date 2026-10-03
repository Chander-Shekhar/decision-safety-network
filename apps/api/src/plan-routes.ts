import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { issuePairingCode } from './ally-pairing.js';
import { acceptInvitation, createInvitation, revokeInvitation, savePlan } from './plan.js';

const RetentionModeSchema = z.enum(['delete-on-close', 'facts-24h', 'selected-7d']);

const PutPlanSchema = z.object({
  thresholdMinor: z.number().int().positive(),
  bankId: z.literal('demo-bank'),
  processingConsent: z.boolean(),
  retentionMode: RetentionModeSchema,
  allySharingConsent: z.boolean(),
  exportConsent: z.boolean(),
});

const CreateInvitationSchema = z.object({
  pairingCode: z.string().min(1),
});

/**
 * Domain errors this module's own functions throw that are client input/
 * business-rule failures, not the shared `app.ts` error vocabulary
 * (UNAUTHENTICATED/FORBIDDEN/NOT_FOUND/...). `app.ts` is serialized and not
 * ours to extend, so each route handler maps these locally to 400 and
 * re-throws anything else, letting the shared handler apply its existing
 * (still-correct) mapping for FORBIDDEN/NOT_FOUND/PLAN_REQUIRED/etc.
 */
const LOCAL_400_ERRORS = new Set(['PAIRING_CODE_NOT_FOUND', 'PAIRING_CODE_EXPIRED', 'PAIRING_CODE_CONSUMED', 'SELF_NOMINATION']);

function replyOrRethrow(reply: FastifyReply, error: unknown): void {
  if (error instanceof Error && LOCAL_400_ERRORS.has(error.message)) {
    reply.code(400).send({ error: error.message });
    return;
  }
  throw error;
}

/**
 * Safety Plan and ally-pairing routes (plan Task 2 / DSN-004). Registered
 * standalone via `buildApi([planRoutes], deps)` in tests; Task 12 composes
 * this installer into the public app without editing it.
 */
export const planRoutes: RouteInstaller = (app, deps: ApiDeps) => {
  app.put('/api/v1/plan', async (request, reply) => {
    const uid = await requireUser(request, deps.auth);
    const parsed = PutPlanSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'INVALID_PLAN' });
      return undefined;
    }
    return savePlan(deps.db, uid, parsed.data);
  });

  app.post('/api/v1/ally-pairing-code', async (request) => {
    const uid = await requireUser(request, deps.auth);
    return issuePairingCode(deps.db, uid);
  });

  app.post('/api/v1/ally-invitations', async (request, reply) => {
    const uid = await requireUser(request, deps.auth);
    const parsed = CreateInvitationSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'INVALID_PAIRING_CODE' });
      return undefined;
    }
    try {
      return await createInvitation(deps.db, uid, parsed.data.pairingCode);
    } catch (error) {
      replyOrRethrow(reply, error);
      return undefined;
    }
  });

  app.post('/api/v1/ally-invitations/:id/accept', async (request, reply) => {
    const uid = await requireUser(request, deps.auth);
    const { id } = request.params as { id: string };
    try {
      return await acceptInvitation(deps.db, id, uid);
    } catch (error) {
      replyOrRethrow(reply, error);
      return undefined;
    }
  });

  app.post('/api/v1/ally-invitations/:id/revoke', async (request, reply) => {
    const uid = await requireUser(request, deps.auth);
    const { id } = request.params as { id: string };
    try {
      return await revokeInvitation(deps.db, id, uid);
    } catch (error) {
      replyOrRethrow(reply, error);
      return undefined;
    }
  });
};
