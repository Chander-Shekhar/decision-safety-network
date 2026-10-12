import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { ApiDeps, RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { assertExtractionAuthorized } from './fact-validator.js';
import { createGeminiTranscriptionPort } from './gemini.js';
import type { TranscriptionPort } from '../../../packages/contracts/src/facts.js';

// The uploaded recording is accepted only to transcribe it; it is never
// written to Firestore. Bound the payload so a huge body can't be pushed
// through the model path. base64 inflates bytes ~4/3, so ~8 MB of base64 is
// a short demo clip; the per-route bodyLimit is raised to admit it (the
// app-wide 1 MB default would reject even a brief recording), without editing
// the serialized `app.ts`.
const MAX_AUDIO_BASE64 = 8_000_000;
const BODY_LIMIT_BYTES = 12_000_000;

const BodySchema = z.object({
  audio: z.object({
    mimeType: z
      .string()
      .min(1)
      .max(100)
      .regex(/^audio\//),
    dataBase64: z.string().min(1).max(MAX_AUDIO_BASE64),
  }),
});

// `assertExtractionAuthorized` throws FORBIDDEN (mapped by the shared handler)
// or CONSENT_REQUIRED, which this route maps locally as a permission failure,
// mirroring `fact-routes.ts`.
const LOCAL_ERROR_STATUS: Record<string, number> = { CONSENT_REQUIRED: 403 };

function replyOrRethrow(reply: FastifyReply, error: unknown): undefined {
  if (error instanceof Error && error.message in LOCAL_ERROR_STATUS) {
    reply.code(LOCAL_ERROR_STATUS[error.message]!).send({ error: error.message });
    return undefined;
  }
  throw error;
}

/**
 * Prototype "upload a recording of your call" input (DSN-030). Transcribes an
 * uploaded recording into ordered speaker turns and returns them; it persists
 * nothing - the audio is never stored, and the client appends the returned
 * turns through the existing `cases/:id/segments` + `facts/extract` routes,
 * exactly as the live-capture bridge does, so nothing downstream changes.
 *
 * Owner + processing-consent gated via `assertExtractionAuthorized`
 * (Decision 0004): a non-owner or consent-revoked case triggers zero model
 * calls. The `TranscriptionPort` is injected so tests supply a deterministic
 * fake, mirroring how `createFactRoutes` takes a `GeminiPort`. When no port is
 * injected the real Gemini-backed adapter is constructed lazily on the first
 * authorized request (never at wiring time) - so composing this installer in
 * `buildServer` never constructs a Vertex client in tests or local harnesses
 * that pass a fake Gemini and never exercise this route.
 */
export function createTranscriptionRoutes(port?: TranscriptionPort): RouteInstaller {
  return (app, deps: ApiDeps) => {
    let resolved = port;
    app.post('/api/v1/cases/:id/transcript/audio', { bodyLimit: BODY_LIMIT_BYTES }, async (request, reply) => {
      const uid = await requireUser(request, deps.auth);
      const { id: caseId } = request.params as { id: string };
      const parsed = BodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: 'INVALID_AUDIO' });
        return undefined;
      }
      try {
        await assertExtractionAuthorized(deps.db, uid, caseId);
        resolved ??= createGeminiTranscriptionPort();
        const turns = await resolved.transcribe(parsed.data.audio);
        return { turns };
      } catch (error) {
        return replyOrRethrow(reply, error);
      }
    });
  };
}
