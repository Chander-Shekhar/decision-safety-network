import type { Phase } from '../../../packages/contracts/src/case';

export const STEPS = ['Plan', 'Session', 'Review', 'Decide', 'Ally', 'Recovery', 'Evidence'] as const;
export type Step = (typeof STEPS)[number];

export interface JourneyState {
  role: 'owner' | 'ally' | null;
  planSaved: boolean;
  caseId: string;
  phase?: Phase;
  factsExtracted: boolean;
  recoveryEntered: boolean;
  hasConfirmedFacts: boolean;
}

export interface StepStatus { step: Step; available: boolean; reason?: string }

function ownerStep(step: Step, s: JourneyState): StepStatus {
  switch (step) {
    case 'Plan': return { step, available: true };
    case 'Session': return s.planSaved ? { step, available: true } : { step, available: false, reason: 'Save your Safety Plan first.' };
    case 'Review': return s.caseId ? { step, available: true } : { step, available: false, reason: 'Start a controlled session first.' };
    case 'Decide':
    case 'Ally': return s.factsExtracted ? { step, available: true } : { step, available: false, reason: 'Facts must be extracted first.' };
    case 'Recovery': return s.recoveryEntered ? { step, available: true } : { step, available: false, reason: "Available after you choose “I already paid”." };
    case 'Evidence': return s.hasConfirmedFacts ? { step, available: true } : { step, available: false, reason: 'Confirm at least one fact first.' };
  }
}

export function journeySteps(s: JourneyState): StepStatus[] {
  if (s.role === 'ally') {
    return STEPS.map((step) => step === 'Ally' ? { step, available: true } : { step, available: false, reason: 'Available to the case owner.' });
  }
  return STEPS.map((step) => ownerStep(step, s));
}

export function initialStep(s: JourneyState): Step {
  if (s.role === 'ally') return 'Ally';
  if (s.recoveryEntered) return 'Recovery';
  if (!s.planSaved) return 'Plan';
  if (!s.caseId) return 'Session';
  return 'Review';
}
