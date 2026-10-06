import type { Phase } from '../../../packages/contracts/src/case';

export const STEPS = ['Plan', 'Session', 'Decision', 'Verify', 'Ally', 'Recovery', 'Evidence'] as const;
export type Step = (typeof STEPS)[number];

export interface JourneyState {
  role: 'owner' | 'ally' | null;
  planSaved: boolean;
  caseId: string;
  phase?: Phase;
  factsExtracted: boolean;
  paymentExists: boolean;
  hasVerification: boolean;
  recoveryEntered: boolean;
  hasConfirmedFacts: boolean;
}

export interface StepStatus { step: Step; available: boolean; reason?: string }

const VERIFY_GUIDANCE = 'Submit the simulated transfer to enable official verification.';

export function canVerify(s: JourneyState): { allowed: boolean; reason?: string } {
  if (s.hasVerification || s.phase === 'Check' || s.phase === 'Pause') return { allowed: true };
  return { allowed: false, reason: VERIFY_GUIDANCE };
}

function ownerStep(step: Step, s: JourneyState): StepStatus {
  switch (step) {
    case 'Plan': return { step, available: true };
    case 'Session': return s.planSaved ? { step, available: true } : { step, available: false, reason: 'Save your Safety Plan first.' };
    case 'Decision': return s.caseId ? { step, available: true } : { step, available: false, reason: 'Start a controlled session first.' };
    case 'Verify':
    case 'Ally': return s.factsExtracted ? { step, available: true } : { step, available: false, reason: 'Facts must be extracted first.' };
    case 'Recovery': return s.paymentExists || s.recoveryEntered ? { step, available: true } : { step, available: false, reason: 'Available once a transfer is drafted.' };
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
  return 'Decision';
}
