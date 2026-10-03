import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CaseEnvelope } from '@dsn/contracts';
import { commitCaseCommand, createCase, readCase } from '../src/case-store.js';

let db: Firestore;

beforeAll(() => {
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-dsn' });
  }
  db = getFirestore();
});

async function seedOwnerPlan(planVersion = 1): Promise<string> {
  const ownerUid = `owner-${randomUUID()}`;
  await db.collection('plans').doc(ownerUid).set({ version: planVersion });
  return ownerUid;
}

const toCheck = (c: CaseEnvelope) => ({ ...c, phase: 'Check' as const });

describe('createCase', () => {
  it('requires an existing owner plan document', async () => {
    const ownerUid = `owner-${randomUUID()}`;
    await expect(createCase(db, ownerUid, 1)).rejects.toThrow('PLAN_REQUIRED');
  });

  it('writes a new Observe-phase case at version 0', async () => {
    const ownerUid = await seedOwnerPlan(1);
    const created = await createCase(db, ownerUid, 1);
    expect(created.ownerUid).toBe(ownerUid);
    expect(created.phase).toBe('Observe');
    expect(created.version).toBe(0);
    expect(created.planVersion).toBe(1);
  });
});

describe('readCase', () => {
  it('denies a user who is not the owner', async () => {
    const ownerUid = await seedOwnerPlan();
    const other = `other-${randomUUID()}`;
    const created = await createCase(db, ownerUid, 1);
    await expect(readCase(db, other, created.id)).rejects.toThrow('FORBIDDEN');
  });

  it('denies reads for a case that does not exist, same as a wrong owner', async () => {
    await expect(readCase(db, `nobody-${randomUUID()}`, randomUUID())).rejects.toThrow('FORBIDDEN');
  });

  it('returns the case to its owner', async () => {
    const ownerUid = await seedOwnerPlan();
    const created = await createCase(db, ownerUid, 1);
    const read = await readCase(db, ownerUid, created.id);
    expect(read).toEqual(created);
  });

  it('denies the owner once expiresAt is in the past', async () => {
    const ownerUid = await seedOwnerPlan();
    const created = await createCase(db, ownerUid, 1);
    const past = new Date(Date.now() - 60_000).toISOString();
    await db.collection('cases').doc(created.id).update({ expiresAt: past });
    await expect(readCase(db, ownerUid, created.id)).rejects.toThrow('EXPIRED');
  });

  it('still returns the case when expiresAt is unset or in the future', async () => {
    const ownerUid = await seedOwnerPlan();
    const created = await createCase(db, ownerUid, 1);
    const future = new Date(Date.now() + 60_000).toISOString();
    await db.collection('cases').doc(created.id).update({ expiresAt: future });
    const read = await readCase(db, ownerUid, created.id);
    expect(read.expiresAt).toBe(future);
  });
});

describe('commitCaseCommand', () => {
  it('matches the plan Task 1 Step 2 transaction and authorization assertions', async () => {
    const ownerUid = await seedOwnerPlan(1);
    const created = await createCase(db, ownerUid, 1);

    const cmd = {
      caseId: created.id,
      actorUid: ownerUid,
      idempotencyKey: randomUUID(),
      expectedVersion: 0,
      kind: 'check',
      payload: {},
    };
    const reduce = toCheck;

    const first = await commitCaseCommand(db, cmd, reduce);
    const again = await commitCaseCommand(db, cmd, () => {
      throw new Error('replayed');
    });
    expect(again).toEqual(first);
    expect((await db.collection('cases').doc(cmd.caseId).collection('events').get()).size).toBe(1);

    await expect(
      commitCaseCommand(db, { ...cmd, actorUid: 'other', idempotencyKey: randomUUID() }, reduce),
    ).rejects.toThrow('FORBIDDEN');
    // Same key as the already-committed command, but a different (non-owner)
    // actor: ownership must be checked before the idempotency receipt, so
    // this is FORBIDDEN rather than a replay or an IDEMPOTENCY_CONFLICT.
    await expect(commitCaseCommand(db, { ...cmd, actorUid: 'other' }, reduce)).rejects.toThrow('FORBIDDEN');
    await expect(commitCaseCommand(db, { ...cmd, payload: { different: true } }, reduce)).rejects.toThrow(
      'IDEMPOTENCY_CONFLICT',
    );
  });

  it('rejects a stale expectedVersion as VERSION_CONFLICT', async () => {
    const ownerUid = await seedOwnerPlan();
    const created = await createCase(db, ownerUid, 1);
    await expect(
      commitCaseCommand(
        db,
        {
          caseId: created.id,
          actorUid: ownerUid,
          idempotencyKey: randomUUID(),
          expectedVersion: 5,
          kind: 'check',
          payload: {},
        },
        toCheck,
      ),
    ).rejects.toThrow('VERSION_CONFLICT');
  });

  it('rejects a non-UUID idempotency key', async () => {
    const ownerUid = await seedOwnerPlan();
    const created = await createCase(db, ownerUid, 1);
    await expect(
      commitCaseCommand(
        db,
        {
          caseId: created.id,
          actorUid: ownerUid,
          idempotencyKey: 'not-a-uuid',
          expectedVersion: 0,
          kind: 'check',
          payload: {},
        },
        toCheck,
      ),
    ).rejects.toThrow('INVALID_IDEMPOTENCY_KEY');
  });

  it('advances the case version and phase on a fresh command', async () => {
    const ownerUid = await seedOwnerPlan();
    const created = await createCase(db, ownerUid, 1);
    const receipt = await commitCaseCommand(
      db,
      {
        caseId: created.id,
        actorUid: ownerUid,
        idempotencyKey: randomUUID(),
        expectedVersion: 0,
        kind: 'check',
        payload: {},
      },
      toCheck,
    );
    expect(receipt).toEqual({ id: created.id, version: 1, phase: 'Check' });
    const updated = await readCase(db, ownerUid, created.id);
    expect(updated.version).toBe(1);
    expect(updated.phase).toBe('Check');
  });
});
