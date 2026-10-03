import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { buildApi, type ApiDeps } from '../src/app.js';
import { caseRoutes } from '../src/case-store.js';
import { authHeader } from './test-auth.js';

let db: Firestore;
let deps: ApiDeps;

beforeAll(() => {
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-dsn' });
  }
  db = getFirestore();
  deps = { auth: getAuth(), db, now: () => new Date() };
});

describe('authenticated case API', () => {
  it('denies a request with no bearer token', async () => {
    const app = buildApi([caseRoutes], deps);
    const response = await app.inject({ method: 'POST', url: '/api/v1/cases' });
    expect(response.statusCode).toBe(401);
  });

  it('denies a request with a malformed authorization header', async () => {
    const app = buildApi([caseRoutes], deps);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/does-not-matter',
      headers: { authorization: 'not-bearer-at-all' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('denies a request with an invalid/unverifiable token', async () => {
    const app = buildApi([caseRoutes], deps);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/does-not-matter',
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('lets an authenticated owner create and read their case', async () => {
    const ownerUid = `owner-${randomUUID()}`;
    await db.collection('plans').doc(ownerUid).set({ version: 1 });

    const app = buildApi([caseRoutes], deps);
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: await authHeader(ownerUid),
    });
    expect(createResponse.statusCode).toBe(200);
    const created = createResponse.json() as { id: string; ownerUid: string };
    expect(created.ownerUid).toBe(ownerUid);

    const readResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${created.id}`,
      headers: await authHeader(ownerUid),
    });
    expect(readResponse.statusCode).toBe(200);
    expect((readResponse.json() as { id: string }).id).toBe(created.id);
  });

  it('denies another authenticated user from reading or commanding the case', async () => {
    const ownerUid = `owner-${randomUUID()}`;
    const otherUid = `other-${randomUUID()}`;
    await db.collection('plans').doc(ownerUid).set({ version: 1 });

    const app = buildApi([caseRoutes], deps);
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: await authHeader(ownerUid),
    });
    const created = createResponse.json() as { id: string };

    const deniedRead = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${created.id}`,
      headers: await authHeader(otherUid),
    });
    expect(deniedRead.statusCode).toBe(403);
  });

  it('rejects case creation when the owner has no plan yet', async () => {
    const ownerUid = `owner-${randomUUID()}`;
    const app = buildApi([caseRoutes], deps);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: await authHeader(ownerUid),
    });
    expect(response.statusCode).toBe(400);
  });
});
