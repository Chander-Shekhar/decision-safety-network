// Scheduler-only sweep route for Task 11 (DSN-013). POST
// /internal/retention/sweep is reachable only by a dedicated Cloud Scheduler
// service identity presenting a Google-signed OIDC token with the configured
// audience and service-account email - never by a Firebase user ID token,
// which this module never even attempts to verify as one (a Firebase token's
// own `aud`/`email` claims are the end user's, not the scheduler's, so the
// audience/email checks below reject it by construction).
import type { FastifyInstance } from 'fastify';
import { createVerify } from 'node:crypto';
import type { ApiDeps, RouteInstaller } from './app.js';
import { sweepExpiredCases } from './retention.js';

/** Resolves a signing key by `kid`. Production wiring (fetching Google's live JWKS) is deferred to DSN-014 (see task record); tests inject a fake backed by a locally generated keypair. */
export interface OidcKeySource {
  getPublicKey(kid: string): Promise<string | undefined>;
}

export interface SchedulerIdentityConfig {
  audience: string;
  serviceAccountEmail: string;
  keySource: OidcKeySource;
}

interface OidcHeader {
  alg?: string;
  kid?: string;
}

interface OidcPayload {
  aud?: string;
  email?: string;
  email_verified?: boolean;
  exp?: number;
}

function base64UrlToBuffer(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

function base64UrlDecodeJson<T>(input: string): T | undefined {
  try {
    return JSON.parse(base64UrlToBuffer(input).toString('utf8')) as T;
  } catch {
    return undefined;
  }
}

async function verifySchedulerOidcToken(token: string, config: SchedulerIdentityConfig): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const header = base64UrlDecodeJson<OidcHeader>(headerB64);
  const payload = base64UrlDecodeJson<OidcPayload>(payloadB64);
  if (!header || !payload) {
    return false;
  }
  if (header.alg !== 'RS256' || !header.kid) {
    return false;
  }
  if (payload.aud !== config.audience) {
    return false;
  }
  if (payload.email !== config.serviceAccountEmail || payload.email_verified !== true) {
    return false;
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
    return false;
  }

  const publicKeyPem = await config.keySource.getPublicKey(header.kid);
  if (!publicKeyPem) {
    return false;
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  try {
    return verifier.verify(publicKeyPem, base64UrlToBuffer(signatureB64));
  } catch {
    return false;
  }
}

export function createRetentionRoutes(config: SchedulerIdentityConfig): RouteInstaller {
  return (app: FastifyInstance, deps: ApiDeps) => {
    app.post('/internal/retention/sweep', async (request, reply) => {
      const header = request.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        reply.code(401).send({ error: 'UNAUTHENTICATED' });
        return undefined;
      }
      const token = header.slice('Bearer '.length).trim();
      const verified = await verifySchedulerOidcToken(token, config);
      if (!verified) {
        reply.code(401).send({ error: 'UNAUTHENTICATED' });
        return undefined;
      }

      const swept = await sweepExpiredCases(deps.db, deps.now);
      return { swept };
    });
  };
}
