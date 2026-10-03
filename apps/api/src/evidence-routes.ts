// HTTP surface for Task 11 (DSN-013). This module owns the SOLE
// POST /api/v1/cases/:id/session/close route - no other module may call
// session.ts's internal endSession directly (see session.ts's own doc
// comment, which deliberately exposes no public route of its own).
import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { readCase } from './case-store.js';
import {
  closeSessionWithRetention,
  promoteEvidence,
  readSelectedEvidence,
  revokeExportConsent,
  revokeRetentionConsent,
} from './retention.js';
import { buildExportZip } from './export.js';
import type { RetentionMode } from '../../../packages/contracts/src/evidence.js';

const CloseBodySchema = z.object({ mode: z.enum(['delete-on-close', 'facts-24h', 'selected-7d']) });
const RetentionRevokeBodySchema = z.object({ downgradeTo: z.enum(['delete-on-close', 'facts-24h']).optional() });

/** Error messages this module itself throws, mapped to their HTTP status. Anything else re-throws to app.ts's shared STATUS_BY_ERROR_MESSAGE (or its 500 fallback). */
const LOCAL_ERROR_STATUS: Record<string, number> = {
  MODE_MISMATCH: 409,
  SESSION_CLOSED: 403,
  SEGMENT_NOT_FOUND: 404,
  EXPORT_CONSENT_REQUIRED: 403,
  NOT_SELECTED_RETENTION: 400,
  EXPIRED: 410,
  CONCURRENT_MODIFICATION: 409,
};

function replyOrRethrow(reply: FastifyReply, error: unknown): undefined {
  if (error instanceof Error && error.message in LOCAL_ERROR_STATUS) {
    reply.code(LOCAL_ERROR_STATUS[error.message]!).send({ error: error.message });
    return undefined;
  }
  throw error;
}

export function createEvidenceRoutes(): RouteInstaller {
  return (app, deps: ApiDeps) => {
    app.post('/api/v1/cases/:id/session/close', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = CloseBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        await closeSessionWithRetention(deps.db, uid, caseId, parsed.data.mode as RetentionMode);
        reply.code(204);
        return undefined;
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/evidence/:segmentId/promote', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId, segmentId } = request.params as { id: string; segmentId: string };
      try {
        return await promoteEvidence(deps.db, uid, caseId, segmentId);
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.get('/api/v1/cases/:id/evidence', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const { ids } = request.query as { ids?: string };
      if (!ids) {
        reply.code(400).send({ error: 'INVALID_QUERY' });
        return undefined;
      }
      try {
        // readCase enforces ownership/expiry first; readSelectedEvidence
        // itself performs no ownership check (see its own doc comment).
        await readCase(deps.db, uid, caseId);
        const selectedIds = ids.split(',').map((id) => id.trim()).filter(Boolean);
        return await readSelectedEvidence(deps.db, caseId, selectedIds);
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/export', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      try {
        const { filename, zip } = await buildExportZip(deps.db, uid, caseId);
        reply.header('content-type', 'application/zip');
        reply.header('content-disposition', `attachment; filename="${filename}"`);
        return reply.send(zip);
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/export-consent/revoke', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      try {
        await revokeExportConsent(deps.db, uid, caseId);
        reply.code(204);
        return undefined;
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/retention-consent/revoke', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = RetentionRevokeBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        await revokeRetentionConsent(deps.db, uid, caseId, parsed.data.downgradeTo ?? 'facts-24h');
        reply.code(204);
        return undefined;
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });
  };
}
