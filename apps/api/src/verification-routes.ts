import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { verifyWithDemoBank } from './verification.js';
import { DEMO_BANK_REGISTRY } from './demo-bank-registry.js';

/**
 * Deliberately an empty, strict schema: `verifyWithDemoBank` takes no body
 * at all (it only ever consults the versioned registry and the owner's own
 * saved plan), so ANY body field - including a caller-suggested phone
 * number, callback, URL, or route - is rejected as a malformed request
 * before `verifyWithDemoBank` is ever called. This is the enforcement point
 * for "caller-supplied contacts are rejected": there is no field on this
 * schema through which one could be smuggled in.
 */
const VerifyBodySchema = z.object({}).strict();

/**
 * Domain errors `verification.ts` throws that are not the shared `app.ts`
 * error vocabulary (FORBIDDEN/PLAN_REQUIRED/VERSION_CONFLICT/... are
 * already mapped there). `app.ts` is serialized and not ours to extend, so
 * this module maps these locally and re-throws anything else, mirroring
 * `fact-routes.ts`/`payment-routes.ts`/`decision-routes.ts`. `UNKNOWN_BANK`
 * is a malformed/unsupported plan state (400); `ILLEGAL_TRANSITION` is a
 * state conflict (409), matching the sibling `VERSION_CONFLICT` code.
 */
const LOCAL_ERROR_STATUS: Record<string, number> = {
  UNKNOWN_BANK: 400,
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
 * Completed Demo Bank verification routes (plan Task 8 / DSN-010): the one
 * actionable verification command, and a read-only registry route for the
 * client to render provenance from (frame 04's "FICTIONAL DEMO BANK ·
 * REGISTRY v1.0"). Neither route takes a `GeminiPort` - `verifyWithDemoBank`
 * never calls the model, mirroring `createDecisionRoutes`. Mounting these
 * routes into the shared public app is deferred to the integrator (Task 12
 * / DSN-014, per the plan's file map); tests build an isolated app via
 * `buildApi([createVerificationRoutes()], deps)`.
 */
export function createVerificationRoutes(): RouteInstaller {
  return (app, deps: ApiDeps) => {
    app.post('/api/v1/cases/:id/verify', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = VerifyBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        return await verifyWithDemoBank(deps.db, caseId, uid);
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.get('/api/v1/registry/demo-bank', async (request) => {
      await requireUser(request, deps.auth);
      return DEMO_BANK_REGISTRY;
    });
  };
}
