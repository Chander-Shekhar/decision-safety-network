import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { addConfirmedFraud, maskNumber, normalizeNumber } from './fraud-list.js';
import { screenCall } from './screening.js';
import { createSimulatedCallerIdAdapter, type CallerIdAdapter } from './screening-adapter.js';

// The number travels in the body, never the URL, so it stays out of access logs.
// There is deliberately no field a client could send to set trust, the
// official route, certification, or a fraud-list entry from a raw signal.
const CheckBodySchema = z.object({
  number: z.string().min(1).max(40),
  caseId: z.string().min(1).optional(),
});

const ConfirmBodySchema = z.object({
  callerNumber: z.string().min(1).max(40),
  basis: z.enum(['user-confirmed', 'authority-report']),
});

const LOCAL_ERROR_STATUS: Record<string, number> = {
  REPORT_NOT_RECORDED: 409,
};

function replyOrRethrow(reply: FastifyReply, error: unknown): undefined {
  if (error instanceof Error && error.message in LOCAL_ERROR_STATUS) {
    reply.code(LOCAL_ERROR_STATUS[error.message]!).send({ error: error.message });
    return undefined;
  }
  throw error;
}

/** Pre-pickup screening + private fraud-list routes (DSN-024). The caller-ID adapter is injectable. */
export function createScreeningRoutes(adapter: CallerIdAdapter = createSimulatedCallerIdAdapter()): RouteInstaller {
  return (app, deps: ApiDeps) => {
    app.post('/api/v1/screening/check', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const parsed = CheckBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      const outcome = await screenCall(deps.db, adapter, uid, parsed.data.number, { caseId: parsed.data.caseId });
      if (!outcome.ok) {
        reply.code(400).send({ error: outcome.error });
        return undefined;
      }
      return outcome.verdict;
    });

    app.post('/api/v1/cases/:id/fraud-confirmation', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = ConfirmBodySchema.safeParse(request.body);
      const normalized = parsed.success ? normalizeNumber(parsed.data.callerNumber) : null;
      if (!parsed.success || !normalized) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        const entry = await addConfirmedFraud(deps.db, uid, { caseId, normalizedNumber: normalized, basis: parsed.data.basis });
        return { maskedNumber: maskNumber(normalized), basis: entry.basis, addedAt: entry.addedAt, private: true };
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });
  };
}
