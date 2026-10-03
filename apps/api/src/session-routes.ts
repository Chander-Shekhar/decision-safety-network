import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { appendSegment, revokeProcessing } from './session.js';

const AppendSegmentBodySchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  speaker: z.string().min(1),
  text: z.string().min(1),
});

/**
 * Domain errors this module's own functions throw that are not the shared
 * `app.ts` error vocabulary (FORBIDDEN/NOT_FOUND/PLAN_REQUIRED/...). `app.ts`
 * is serialized and not ours to extend, so each route handler maps these
 * locally and re-throws anything else, letting the shared handler apply its
 * existing (still-correct) mapping for FORBIDDEN/etc. `ORDER_CONFLICT` is a
 * conflict (409), matching the sibling `VERSION_CONFLICT`/`IDEMPOTENCY_CONFLICT`
 * codes already in that shared map; `CONSENT_REQUIRED` is treated as a
 * permission failure (403), since it means consent for this action has been
 * withdrawn, not that the request body was malformed.
 */
const LOCAL_ERROR_STATUS: Record<string, number> = {
  ORDER_CONFLICT: 409,
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
 * Controlled-session routes (plan Task 3 / DSN-005). Registered standalone
 * via `buildApi([sessionRoutes], deps)` in tests; Task 12 composes this
 * installer into the public app without editing it. There is deliberately
 * no close/end route here - Task 11 (DSN-013) owns the sole HTTP close
 * command and calls `session.ts`'s internal `endSession` itself.
 *
 * This route's own `onSegment` callback is a no-op: Task 3 has no model
 * dependency. A later task that wants to react to newly accepted segments
 * (e.g. triggering live Gemini extraction) calls `appendSegment` directly
 * with its own callback from its own route, rather than this file being
 * edited to grow one.
 */
export const sessionRoutes: RouteInstaller = (app, deps: ApiDeps) => {
  app.post('/api/v1/cases/:id/segments', async (request, reply) => {
    const uid = await requireUser(request, deps.auth);
    const { id: caseId } = request.params as { id: string };
    const parsed = AppendSegmentBodySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'INVALID_SEGMENT' });
      return undefined;
    }
    try {
      return await appendSegment(deps.db, uid, { ...parsed.data, caseId }, () => {});
    } catch (error) {
      return replyOrRethrow(reply, error);
    }
  });

  app.post('/api/v1/cases/:id/processing/revoke', async (request, reply) => {
    const uid = await requireUser(request, deps.auth);
    const { id: caseId } = request.params as { id: string };
    try {
      await revokeProcessing(deps.db, uid, caseId);
      reply.code(204);
      return undefined;
    } catch (error) {
      return replyOrRethrow(reply, error);
    }
  });
};
