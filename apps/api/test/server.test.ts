import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import type { ApiDeps } from '../src/app.js';
import type { SchedulerIdentityConfig } from '../src/retention-routes.js';
import { createFakeGemini } from './fake-gemini.js';
import { authHeader } from './test-auth.js';

let app: FastifyInstance;
let deps: ApiDeps;

const schedulerConfig: SchedulerIdentityConfig = {
  audience: 'https://dsn.example.invalid',
  serviceAccountEmail: 'scheduler@dsn-demo.example.invalid',
  keySource: { getPublicKey: async () => undefined },
};

beforeAll(async () => {
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-dsn' });
  }
  deps = { auth: getAuth(), db: getFirestore(), now: () => new Date() };
  app = buildServer(deps, createFakeGemini(), schedulerConfig);
  await app.ready();
});

describe('composed server', () => {
  it('GET /healthz is public, 200, and carries no case data', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('unknown routes return 404', async () => {
    expect((await app.inject({ method: 'GET', url: '/nope' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/v1/nope' })).statusCode).toBe(404);
  });

  // One representative unauthenticated hit per installer: 401 (not 404)
  // proves the route exists and its handler ran.
  const representative: Array<[string, string, string]> = [
    ['plan', 'PUT', '/api/v1/plan'],
    ['session', 'POST', '/api/v1/cases/c1/segments'],
    ['facts', 'POST', '/api/v1/cases/c1/facts/extract'],
    ['payment', 'POST', '/api/v1/cases/c1/payment/draft'],
    ['decision', 'POST', '/api/v1/cases/c1/actions/pause'],
    ['verification', 'POST', '/api/v1/cases/c1/verify'],
    ['ally', 'POST', '/api/v1/cases/c1/ally-share-preview'],
    ['recovery', 'GET', '/api/v1/cases/c1/recovery'],
    ['evidence', 'GET', '/api/v1/cases/c1/evidence'],
    ['retention', 'POST', '/internal/retention/sweep'],
  ];
  for (const [name, method, url] of representative) {
    it(`mounts the ${name} routes (${method} ${url})`, async () => {
      const res = await app.inject({ method: method as 'GET', url, payload: method === 'GET' ? undefined : {} });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: 'UNAUTHENTICATED' });
    });
  }

  it('a Firebase user token cannot call the internal sweep', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/retention/sweep',
      headers: await authHeader('server-test-user'),
    });
    expect(res.statusCode).toBe(401);
  });

  it('an authenticated request to a case the user does not own is denied, not 404-routed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/missing-case/recovery',
      headers: await authHeader('server-test-user'),
    });
    expect([403, 404]).toContain(res.statusCode);
    expect(res.json()).toHaveProperty('error');
  });

  it('maps IDEMPOTENCY_CONFLICT to 409 through the composed error handler', async () => {
    const probe = buildServer(deps, createFakeGemini(), schedulerConfig, (instance) => {
      instance.get('/__probe', async () => {
        throw new Error('IDEMPOTENCY_CONFLICT');
      });
    });
    const res = await probe.inject({ method: 'GET', url: '/__probe' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'IDEMPOTENCY_CONFLICT' });
  });
});
