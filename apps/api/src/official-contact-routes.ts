import { z } from 'zod';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import {
  createCuratedOfficialContactLookup,
  officialContactForCase,
  type OfficialContactLookup,
} from './official-contact.js';

// The claimed identity rides in the body (never the URL). There is deliberately
// no field through which a caller-supplied phone number, route, or URL could be
// sent: the only input is the extracted claimed-identity text, and the number
// is sourced server-side (demo registry or official web search).
const BodySchema = z.object({
  claimedIdentity: z.string().min(1).max(300),
});

/**
 * Decide-step official-contact route (DSN-038): resolves a callable number for
 * the organisation the caller claims to be, so the owner can reach it directly.
 * The lookup is injectable - the Cup default is the deterministic curated
 * lookup (Demo Bank only); `server.ts` selects the live Gemini web-search
 * lookup when grounding is enabled.
 */
export function createOfficialContactRoutes(
  lookup: OfficialContactLookup = createCuratedOfficialContactLookup(),
): RouteInstaller {
  return (app, deps: ApiDeps) => {
    app.post('/api/v1/cases/:id/official-contact', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = BodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      return officialContactForCase(deps.db, uid, caseId, lookup, parsed.data.claimedIdentity);
    });
  };
}
