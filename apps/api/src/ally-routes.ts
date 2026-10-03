import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { createAllyGrant, previewAllyPacket, readAllyPacket, respondAsAlly, revokeGrant } from './ally.js';

const SelectionSchema = z.array(z.string().min(1)).min(1).max(10);
const PreviewBodySchema = z.object({ selectedEvidenceIds: SelectionSchema }).strict();
const GrantBodySchema = z
  .object({
    allyUid: z.string().min(1),
    selectedEvidenceIds: SelectionSchema,
    expectedCaseVersion: z.number().int().nonnegative(),
    expectedPacketHash: z.string().min(1),
  })
  .strict();
const RevokeQuerySchema = z.object({ allyUid: z.string().min(1) });

/**
 * Domain errors `ally.ts` throws that are not in the shared `app.ts` error
 * vocabulary (`app.ts` is serialized and not ours to extend), mapped
 * locally. Stale previews/grants are conflicts (409); malformed selections
 * and responses are bad requests (400).
 */
const LOCAL_ERROR_STATUS: Record<string, number> = {
  STALE_PREVIEW: 409,
  STALE_GRANT: 409,
  UNKNOWN_EVIDENCE: 400,
  INVALID_SELECTION: 400,
  INVALID_RESPONSE: 400,
};

function replyOrRethrow(reply: FastifyReply, error: unknown): undefined {
  if (error instanceof Error && error.message in LOCAL_ERROR_STATUS) {
    reply.code(LOCAL_ERROR_STATUS[error.message]!).send({ error: error.message });
    return undefined;
  }
  throw error;
}

/**
 * Case-scoped Safety Ally routes (plan Task 9 / DSN-011). Owner routes
 * authenticate the token UID as the case owner; ally routes authenticate the
 * token UID as the ally and recheck every authorization predicate on every
 * request. Ally routes expose only the allowlisted packet and the three
 * advisory responses - never payment, verification, or transcript routes.
 * Not mounted into `app.ts` here; Task 12 / DSN-014 composes it.
 */
export function createAllyRoutes(): RouteInstaller {
  return (app, deps: ApiDeps) => {
    app.post('/api/v1/cases/:id/ally-share-preview', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = PreviewBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        const preview = await previewAllyPacket(deps.db, uid, caseId, parsed.data, deps.now);
        reply.header('cache-control', 'no-store');
        return preview;
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/ally-grant', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = GrantBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        const grant = await createAllyGrant(deps.db, uid, caseId, parsed.data, deps.now);
        reply.header('cache-control', 'no-store');
        return grant;
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.delete('/api/v1/cases/:id/ally-grant', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = RevokeQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_QUERY' });
        return undefined;
      }
      try {
        await revokeGrant(deps.db, uid, caseId, parsed.data.allyUid, deps.now);
        reply.code(204);
        return undefined;
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.get('/api/v1/ally/cases/:id', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      try {
        const packet = await readAllyPacket(deps.db, uid, caseId, deps.now);
        reply.header('cache-control', 'no-store');
        return packet;
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/ally/cases/:id/response', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      try {
        await respondAsAlly(deps.db, uid, caseId, request.body as never, deps.now);
        reply.code(204);
        return undefined;
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });
  };
}
