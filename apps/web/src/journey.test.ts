import { describe, it, expect } from 'vitest';
import { journeySteps, initialStep, canVerify, type JourneyState } from './journey';

const base: JourneyState = {
  role: 'owner', planSaved: false, caseId: '', phase: undefined,
  factsExtracted: false, paymentExists: false, hasVerification: false,
  recoveryEntered: false, hasConfirmedFacts: false,
};
const avail = (steps = journeySteps(base)) => steps.filter((s) => s.available).map((s) => s.step);

describe('canVerify', () => {
  it('blocks verify from Observe with guidance and no allowance', () => {
    const r = canVerify({ ...base, phase: 'Observe' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/submit the simulated transfer/i);
  });
  it('allows verify from Check and Pause', () => {
    expect(canVerify({ ...base, phase: 'Check' }).allowed).toBe(true);
    expect(canVerify({ ...base, phase: 'Pause' }).allowed).toBe(true);
  });
  it('allows verify once a verification already exists, regardless of phase', () => {
    expect(canVerify({ ...base, phase: 'Observe', hasVerification: true }).allowed).toBe(true);
  });
});

describe('journeySteps (owner)', () => {
  it('fresh owner: only Plan available', () => {
    expect(avail()).toEqual(['Plan']);
  });
  it('plan saved: Session unlocks', () => {
    expect(avail(journeySteps({ ...base, planSaved: true }))).toEqual(['Plan', 'Session']);
  });
  it('case + extracted facts: Decision, Verify, Ally unlock; Evidence needs confirmed facts', () => {
    const steps = journeySteps({ ...base, planSaved: true, caseId: 'c1', factsExtracted: true });
    expect(avail(steps)).toEqual(expect.arrayContaining(['Plan', 'Session', 'Decision', 'Verify', 'Ally']));
    expect(avail(steps)).not.toContain('Evidence');
  });
  it('locked steps carry a reason', () => {
    const session = journeySteps(base).find((s) => s.step === 'Session')!;
    expect(session.available).toBe(false);
    expect(session.reason).toBeTruthy();
  });
});

describe('journeySteps (ally)', () => {
  it('ally sees only the Ally step available', () => {
    expect(avail(journeySteps({ ...base, role: 'ally' }))).toEqual(['Ally']);
  });
});

describe('initialStep', () => {
  it('ally → Ally', () => expect(initialStep({ ...base, role: 'ally' })).toBe('Ally'));
  it('no plan → Plan', () => expect(initialStep(base)).toBe('Plan'));
  it('plan but no case → Session', () => expect(initialStep({ ...base, planSaved: true })).toBe('Session'));
  it('loaded case → Decision', () => expect(initialStep({ ...base, planSaved: true, caseId: 'c1' })).toBe('Decision'));
  it('recovery entered → Recovery', () => expect(initialStep({ ...base, planSaved: true, caseId: 'c1', recoveryEntered: true })).toBe('Recovery'));
});
