import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createCase, readCase } from '../src/case-store.js';
import { savePlan } from '../src/plan.js';
import { revokeProcessing } from '../src/session.js';
import { buildApi, type ApiDeps } from '../src/app.js';
import { authHeader } from './test-auth.js';
import { createFactRoutes } from '../src/fact-routes.js';
import { sessionRoutes } from '../src/session-routes.js';
import { createTranscriptionRoutes } from '../src/transcription-routes.js';
import { createFakeGemini, createFakeTranscription } from './fake-gemini.js';
import type { AudioInput, FactsProjection, TranscriptionPort, TranscriptTurn } from '../../../packages/contracts/src/facts.js';

let db: Firestore;
let deps: ApiDeps;

beforeAll(() => {
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-dsn' });
  }
  db = getFirestore();
  deps = { auth: getAuth(), db, now: () => new Date() };
});

function uid(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

async function seedCase(ownerUid: string, processingConsent = true): Promise<string> {
  await savePlan(db, ownerUid, {
    thresholdMinor: 500_000,
    bankId: 'demo-bank',
    processingConsent,
    retentionMode: 'facts-24h',
    allySharingConsent: true,
    exportConsent: true,
  });
  const created = await createCase(db, ownerUid, 1);
  return created.id;
}

/** base64 of UTF-8 text; the fake transcription double decodes this back into one turn per line. */
function asAudio(text: string, mimeType = 'audio/webm'): { audio: AudioInput } {
  return { audio: { mimeType, dataBase64: Buffer.from(text, 'utf8').toString('base64') } };
}

/** A `TranscriptionPort` that records whether it was ever asked to transcribe. */
function countingTranscription(): TranscriptionPort & { calls: number } {
  const port = {
    calls: 0,
    async transcribe(): Promise<TranscriptTurn[]> {
      port.calls += 1;
      return [{ speaker: 'caller', text: 'hello' }];
    },
  };
  return port;
}

const ATTACK = 'This is the Demo Bank fraud team. Your account is compromised.\nTo protect it move 50,000 to the safe-new account.';

describe('POST /api/v1/cases/:id/transcript/audio', () => {
  it('transcribes an uploaded recording into ordered speaker turns and persists nothing', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const app = buildApi([createTranscriptionRoutes(createFakeTranscription())], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/transcript/audio`,
      headers: await authHeader(ownerUid),
      payload: asAudio(ATTACK),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      turns: [
        { speaker: 'caller', text: 'This is the Demo Bank fraud team. Your account is compromised.' },
        { speaker: 'you', text: 'To protect it move 50,000 to the safe-new account.' },
      ],
    });

    // The route stores nothing: no segment (or any raw audio) is written by it.
    const segments = await db.collection('cases').doc(caseId).collection('segments').get();
    expect(segments.empty).toBe(true);
  });

  it('denies an unauthenticated request', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const app = buildApi([createTranscriptionRoutes(createFakeTranscription())], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/transcript/audio`,
      payload: asAudio(ATTACK),
    });
    expect(response.statusCode).toBe(401);
  });

  it('denies another user and never calls the model (decision 0004)', async () => {
    const ownerUid = uid('owner');
    const impostorUid = uid('impostor');
    const caseId = await seedCase(ownerUid);
    const port = countingTranscription();
    const app = buildApi([createTranscriptionRoutes(port)], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/transcript/audio`,
      headers: await authHeader(impostorUid),
      payload: asAudio(ATTACK),
    });

    expect(response.statusCode).toBe(403);
    expect(port.calls).toBe(0);
  });

  it('returns 403 and never calls the model once processing consent is revoked', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    await revokeProcessing(db, ownerUid, caseId);
    const port = countingTranscription();
    const app = buildApi([createTranscriptionRoutes(port)], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/transcript/audio`,
      headers: await authHeader(ownerUid),
      payload: asAudio(ATTACK),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'CONSENT_REQUIRED' });
    expect(port.calls).toBe(0);
  });

  it('rejects a non-audio or malformed body with 400 before any model call', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const port = countingTranscription();
    const app = buildApi([createTranscriptionRoutes(port)], deps);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/transcript/audio`,
      headers: await authHeader(ownerUid),
      payload: { audio: { mimeType: 'text/plain', dataBase64: 'abc' } },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'INVALID_AUDIO' });
    expect(port.calls).toBe(0);
  });

  it('end to end: transcribed turns feed the same segments + facts/extract pipeline as any transcript', async () => {
    const ownerUid = uid('owner');
    const caseId = await seedCase(ownerUid);
    const app = buildApi(
      [createTranscriptionRoutes(createFakeTranscription()), sessionRoutes, createFactRoutes(createFakeGemini())],
      deps,
    );
    const headers = await authHeader(ownerUid);

    const transcribed = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/transcript/audio`,
      headers,
      payload: asAudio(ATTACK),
    });
    expect(transcribed.statusCode).toBe(200);
    const { turns } = transcribed.json() as { turns: TranscriptTurn[] };

    for (const [i, turn] of turns.entries()) {
      const appended = await app.inject({
        method: 'POST',
        url: `/api/v1/cases/${caseId}/segments`,
        headers,
        payload: { id: `audio-${i + 1}`, order: i + 1, speaker: turn.speaker, text: turn.text },
      });
      expect(appended.statusCode).toBe(200);
    }

    const current = await readCase<FactsProjection>(db, ownerUid, caseId);
    const extracted = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/facts/extract`,
      headers,
      payload: { expectedVersion: current.version },
    });
    expect(extracted.statusCode).toBe(200);
    expect(extracted.json()).toMatchObject({ status: 'ok' });

    const after = await readCase<FactsProjection>(db, ownerUid, caseId);
    expect(after.facts.claimedIdentity?.value).toBe('Demo Bank fraud team');
    expect(after.facts.centralClaim?.value).toBe('Account compromised');
  });
});
