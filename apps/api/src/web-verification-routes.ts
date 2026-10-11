import { z } from 'zod';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { listWebEvidence, recordWebEvidence, verifyClaimOnWeb } from './web-verification.js';
import { createCuratedWebVerificationAdapter, type WebVerificationAdapter } from './web-verification-adapter.js';

// The number travels in the body, never the URL. There is deliberately no
// field a client could send to set trust, the official route, certification,
// or an institution contact.
const BodySchema = z.object({
  claimedIdentity: z.string().min(1).max(300),
  callerNumber: z.string().min(1).max(40),
});

/** Open-web claim-verification routes (DSN-026). Supporting evidence only; the adapter is injectable. */
export function createWebVerificationRoutes(adapter: WebVerificationAdapter = createCuratedWebVerificationAdapter()): RouteInstaller {
  return (app, deps: ApiDeps) => {
    app.post('/api/v1/cases/:id/web-verification', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = BodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      const outcome = await verifyClaimOnWeb(adapter, parsed.data.claimedIdentity, parsed.data.callerNumber, deps.now());
      if (!outcome.ok) {
        reply.code(400).send({ error: outcome.error });
        return undefined;
      }
      await recordWebEvidence(deps.db, uid, caseId, outcome.evidence);
      return outcome.evidence;
    });

    app.get('/api/v1/cases/:id/web-verification', async (request) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      return { evidence: await listWebEvidence(deps.db, uid, caseId) };
    });
  };
}
