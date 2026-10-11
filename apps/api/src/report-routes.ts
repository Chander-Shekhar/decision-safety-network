import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { readReportDraft, recordReportHandoff, renderReportDraftHtml } from './report.js';

const HandoffBodySchema = z.object({
  idempotencyKey: z.uuid(),
  expectedVersion: z.number().int().nonnegative().optional(),
  callerNumber: z.string().min(1).max(40).optional(),
});

const LOCAL_ERROR_STATUS: Record<string, number> = {
  NOT_IN_RECOVERY: 409,
  INVALID_COMMAND: 400,
  INVALID_BODY: 400,
  REPORT_NOT_RECORDED: 409,
};

function replyOrRethrow(reply: FastifyReply, error: unknown): undefined {
  if (error instanceof Error && error.message in LOCAL_ERROR_STATUS) {
    reply.code(LOCAL_ERROR_STATUS[error.message]!).send({ error: error.message });
    return undefined;
  }
  throw error;
}

/** DSN-028 routes. The draft is read-only; only the explicit handoff POST writes (local note + private fraud list). Nothing is ever sent to an authority. */
export function createReportRoutes(): RouteInstaller {
  return (app, deps: ApiDeps) => {
    app.get('/api/v1/cases/:id/report-draft', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      try {
        return await readReportDraft(deps.db, uid, caseId);
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.get('/api/v1/cases/:id/report-draft/download', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      try {
        const draft = await readReportDraft(deps.db, uid, caseId);
        reply.header('content-type', 'text/html; charset=utf-8');
        reply.header('content-disposition', `attachment; filename="report-draft-${caseId}.html"`);
        return reply.send(renderReportDraftHtml(draft));
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/report-handoff', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = HandoffBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        return await recordReportHandoff(deps.db, uid, caseId, parsed.data);
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });
  };
}
