import { pathToFileURL } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { buildApi, type ApiDeps, type RouteInstaller } from './app.js';
import { requireUser } from './auth.js';
import { createCase, readCase } from './case-store.js';
import { createAllyRoutes } from './ally-routes.js';
import { createDecisionRoutes } from './decision-routes.js';
import { createEvidenceRoutes } from './evidence-routes.js';
import { createFactRoutes } from './fact-routes.js';
import { createGeminiPort } from './gemini.js';
import { createPaymentRoutes } from './payment-routes.js';
import { planRoutes } from './plan-routes.js';
import { createRecoveryRoutes } from './recovery-routes.js';
import { createRetentionRoutes, type OidcKeySource, type SchedulerIdentityConfig } from './retention-routes.js';
import { sessionRoutes } from './session-routes.js';
import { createVerificationRoutes } from './verification-routes.js';
import type { GeminiPort } from '../../../packages/contracts/src/facts.js';

/** Public health check: no authentication, no case data. */
const healthRoutes: RouteInstaller = (app) => {
  app.get('/healthz', async () => ({ status: 'ok' }));
};

/**
 * Case lifecycle glue the feature installers do not expose: start a case
 * from the owner's saved plan, and read the owner's own case projection. The
 * browser reads case state only through this API, never Firestore.
 * `createCase` throws `PLAN_REQUIRED` (400) without a saved plan; `readCase`
 * throws `FORBIDDEN` for anyone but the owner.
 */
const caseRoutes: RouteInstaller = (app, deps) => {
  app.post('/api/v1/cases', async (request, reply) => {
    const uid = await requireUser(request, deps.auth);
    const plan = await deps.db.collection('plans').doc(uid).get();
    const created = await createCase(deps.db, uid, (plan.get('version') as number | undefined) ?? 1);
    reply.code(201);
    return created;
  });

  app.get('/api/v1/cases/:id', async (request) => {
    const uid = await requireUser(request, deps.auth);
    const { id } = request.params as { id: string };
    return readCase(deps.db, uid, id);
  });
};

/**
 * Composition root (plan Task 12 / DSN-014). Mounts every feature installer
 * on one Fastify app with three mutually exclusive auth paths: public
 * `/healthz`, Firebase-bearer `/api/v1/**`, and scheduler-OIDC
 * `/internal/retention/sweep`. Each installer owns its own path and auth
 * check; any other path is a 404.
 *
 * The Gemini port is injected: production passes the live adapter, emulator
 * tests pass `test/fake-gemini.ts`. A test double is refused when
 * `NODE_ENV=production`. `configure` lets the bootstrap (or a test) attach
 * extra hooks/routes before the app is ready.
 */
export function buildServer(
  deps: ApiDeps,
  gemini: GeminiPort,
  schedulerConfig: SchedulerIdentityConfig,
  configure?: (app: FastifyInstance) => void,
): FastifyInstance {
  if (process.env.NODE_ENV === 'production' && (gemini as { isTestDouble?: boolean }).isTestDouble === true) {
    throw new Error('TEST_DOUBLE_REJECTED_IN_PRODUCTION');
  }
  const installers: RouteInstaller[] = [
    healthRoutes,
    planRoutes,
    caseRoutes,
    sessionRoutes,
    createFactRoutes(gemini),
    createPaymentRoutes(gemini),
    createDecisionRoutes(),
    createVerificationRoutes(),
    createAllyRoutes(),
    createRecoveryRoutes(),
    createEvidenceRoutes(),
    createRetentionRoutes(schedulerConfig),
  ];
  const app = buildApi(installers, deps);
  configure?.(app);
  return app;
}

const GOOGLE_OIDC_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
const CERT_CACHE_MS = 60 * 60 * 1000;

/** Fetches Google's published OIDC signing certificates (PEM by `kid`), cached for an hour. */
export function createGoogleKeySource(): OidcKeySource {
  let cache: { fetchedAt: number; certs: Record<string, string> } | undefined;
  return {
    async getPublicKey(kid: string): Promise<string | undefined> {
      if (!cache || Date.now() - cache.fetchedAt > CERT_CACHE_MS) {
        const response = await fetch(GOOGLE_OIDC_CERTS_URL);
        if (!response.ok) {
          return undefined;
        }
        cache = { fetchedAt: Date.now(), certs: (await response.json()) as Record<string, string> };
      }
      return cache.certs[kid];
    },
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`MISSING_ENV_${name}`);
  }
  return value;
}

/** Live bootstrap: Firebase Admin + Firestore + the real Gemini adapter, configured from env. Not run on import. */
export async function main(): Promise<void> {
  if (getApps().length === 0) {
    initializeApp();
  }
  const deps: ApiDeps = { auth: getAuth(), db: getFirestore(), now: () => new Date() };
  const schedulerConfig: SchedulerIdentityConfig = {
    audience: requireEnv('DSN_SCHEDULER_AUDIENCE'),
    serviceAccountEmail: requireEnv('DSN_SCHEDULER_SA'),
    keySource: createGoogleKeySource(),
  };
  const app = buildServer(deps, createGeminiPort(), schedulerConfig, (instance) => {
    // Operational logs carry only route template, status, and latency: no case
    // IDs, no request bodies, no headers.
    instance.addHook('onResponse', async (request, reply) => {
      console.log(
        JSON.stringify({
          severity: reply.statusCode >= 500 ? 'ERROR' : 'INFO',
          route: request.routeOptions.url ?? 'unmatched',
          method: request.method,
          status: reply.statusCode,
          latencyMs: Math.round(reply.elapsedTime),
        }),
      );
    });
  });
  await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 8080) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(JSON.stringify({ severity: 'CRITICAL', message: error instanceof Error ? error.message : 'BOOT_FAILED' }));
    process.exit(1);
  });
}
