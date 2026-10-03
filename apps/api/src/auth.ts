import type { FastifyRequest } from 'fastify';
import type { Auth } from 'firebase-admin/auth';

const BEARER_PREFIX = 'Bearer ';

/**
 * Extracts a Firebase ID token from the request's bearer header and verifies
 * it with the Admin SDK, returning the token's UID. Used for both the
 * Firebase-Hosting-rewritten path and direct Cloud Run requests, since
 * Hosting's rewrite can also expose the service publicly.
 */
export async function requireUser(request: FastifyRequest, auth: Auth): Promise<string> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    throw new Error('UNAUTHENTICATED');
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    throw new Error('UNAUTHENTICATED');
  }
  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new Error('UNAUTHENTICATED');
  }
}
