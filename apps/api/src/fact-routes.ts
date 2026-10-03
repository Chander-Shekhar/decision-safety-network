import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { assertExtractionAuthorized, correctFact, confirmFact, extractFacts } from './fact-validator.js';
import { EXTRACT_PROMPT_VERSION } from './gemini.js';
import type { FactSegmentInput, GeminiPort } from '../../../packages/contracts/src/facts.js';
import type { TranscriptSegment } from '../../../packages/contracts/src/session.js';

const ExtractBodySchema = z.object({ expectedVersion: z.number().int().nonnegative() });
const CorrectBodySchema = z.object({ value: z.string().min(1), expectedVersion: z.number().int().nonnegative() });
const ConfirmBodySchema = z.object({ expectedVersion: z.number().int().nonnegative() });

/**
 * Domain errors `fact-validator.ts` throws that are not the shared `app.ts`
 * error vocabulary (FORBIDDEN/VERSION_CONFLICT/... are already mapped
 * there). `app.ts` is serialized and not ours to extend, so each route maps
 * these locally and re-throws anything else, mirroring `session-routes.ts`.
 * `STALE_EXTRACTION` is a conflict (409), matching the sibling
 * `VERSION_CONFLICT` code; `CONSENT_REQUIRED` is a permission failure
 * (403); `UNKNOWN_FIELD`/`INVALID_VALUE`/`NO_MODEL_FACT` are malformed
 * requests (400).
 */
const LOCAL_ERROR_STATUS: Record<string, number> = {
  STALE_EXTRACTION: 409,
  CONSENT_REQUIRED: 403,
  UNKNOWN_FIELD: 400,
  INVALID_VALUE: 400,
  NO_MODEL_FACT: 400,
};

function replyOrRethrow(reply: FastifyReply, error: unknown): undefined {
  if (error instanceof Error && error.message in LOCAL_ERROR_STATUS) {
    reply.code(LOCAL_ERROR_STATUS[error.message]!).send({ error: error.message });
    return undefined;
  }
  throw error;
}

/** Reads this case's currently-persisted ordered segments, for extraction input. Never accepted from the request body - the browser never supplies transcript content directly to this route. */
async function readOrderedSegments(deps: ApiDeps, caseId: string): Promise<FactSegmentInput[]> {
  const snap = await deps.db.collection('cases').doc(caseId).collection('segments').get();
  const segments = snap.docs.map((doc) => doc.data() as TranscriptSegment);
  segments.sort((a, b) => a.order - b.order);
  return segments.map(({ id, speaker, text }) => ({ id, speaker, text }));
}

/**
 * Live-facts routes (plan Task 4 / DSN-006): triggering one fresh extraction
 * pass, and the owner's manual correct/confirm controls. A `GeminiPort` is
 * injected explicitly (rather than threaded through the shared `ApiDeps`,
 * which is serialized/off-limits to extend) so tests can supply a fake port
 * and real wiring (Task 12) can supply `gemini.ts`'s concrete adapter.
 *
 * There is deliberately no HTTP route here for `GeminiPort.relate` - DSN-008
 * (plan Task 6) calls it directly as part of its own draft-recheck flow.
 *
 * Extraction is a separate explicit call from segment append (owned by
 * `session-routes.ts`, which this module does not touch): the caller
 * appends a segment via its existing route, then calls this module's
 * extract route to trigger a fresh model pass over the now-current segment
 * set. This keeps the two concerns independently testable and avoids
 * growing a callback into a file this task does not own.
 */
export function createFactRoutes(gemini: GeminiPort): RouteInstaller {
  return (app, deps: ApiDeps) => {
    app.post('/api/v1/cases/:id/facts/extract', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = ExtractBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        // Decision 0004: ownership/session must be verified before any segment
        // read or model call - a non-owner gets FORBIDDEN with zero of either.
        await assertExtractionAuthorized(deps.db, uid, caseId);
        const segments = await readOrderedSegments(deps, caseId);
        const outcome = await extractFacts(deps.db, uid, caseId, segments, parsed.data.expectedVersion, gemini, {
          modelVersion: EXTRACT_PROMPT_VERSION,
        });
        if (outcome.status === 'degraded') {
          return { status: 'degraded' as const };
        }
        return { status: 'ok' as const, version: outcome.projection.version };
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/facts/:field/correct', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId, field } = request.params as { id: string; field: string };
      const parsed = CorrectBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        await correctFact(deps.db, uid, caseId, field, parsed.data.value, parsed.data.expectedVersion);
        reply.code(204);
        return undefined;
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });

    app.post('/api/v1/cases/:id/facts/:field/confirm', async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId, field } = request.params as { id: string; field: string };
      const parsed = ConfirmBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_BODY' });
        return undefined;
      }
      try {
        await confirmFact(deps.db, uid, caseId, field, parsed.data.expectedVersion);
        reply.code(204);
        return undefined;
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });
  };
}
