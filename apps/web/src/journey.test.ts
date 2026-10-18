import { describe, it, expect } from 'vitest';
import { journeySteps, initialStep, type JourneyState } from './journey';

const base: JourneyState = {
  role: 'owner', planSaved: false, caseId: '', phase: undefined,
  factsExtracted: false,
  recoveryEntered: false,
};
const avail = (steps = journeySteps(base)) => steps.filter((s) => s.available).map((s) => s.step);

describe('journeySteps (owner)', () => {
  it('fresh owner: only Plan available', () => {
    expect(avail()).toEqual(['Plan']);
  });
  it('plan saved: Session unlocks', () => {
    expect(avail(journeySteps({ ...base, planSaved: true }))).toEqual(['Plan', 'Session']);
  });
  it('case + extracted facts: Review, Decide, Ally unlock; Recovery needs "already paid"', () => {
    const steps = journeySteps({ ...base, planSaved: true, caseId: 'c1', factsExtracted: true });
    expect(avail(steps)).toEqual(expect.arrayContaining(['Plan', 'Session', 'Review', 'Decide', 'Ally']));
    expect(avail(steps)).not.toContain('Recovery');
    expect(avail(steps)).not.toContain('Verify');
  });
  it('recovery entered: Recovery unlocks', () => {
    const steps = journeySteps({ ...base, planSaved: true, caseId: 'c1', factsExtracted: true, recoveryEntered: true });
    expect(avail(steps)).toContain('Recovery');
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
  it('loaded case → Review', () => expect(initialStep({ ...base, planSaved: true, caseId: 'c1' })).toBe('Review'));
  it('recovery entered → Recovery', () => expect(initialStep({ ...base, planSaved: true, caseId: 'c1', recoveryEntered: true })).toBe('Recovery'));
});
