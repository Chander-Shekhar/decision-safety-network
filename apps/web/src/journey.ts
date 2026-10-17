import type { Phase } from '../../../packages/contracts/src/case';

export const STEPS = ['Plan', 'Session', 'Review', 'Decide', 'Verify', 'Ally', 'Recovery', 'Evidence'] as const;
export type Step = (typeof STEPS)[number];

export interface JourneyState {
  role: 'owner' | 'ally' | null;
  planSaved: boolean;
  caseId: string;
  phase?: Phase;
  factsExtracted: boolean;
  hasVerification: boolean;
  recoveryEntered: boolean;
  hasConfirmedFacts: boolean;
}

export interface StepStatus { step: Step; available: boolean; reason?: string }

const VERIFY_GUIDANCE = 'Add the call first so there is something to verify.';

export function canVerify(s: JourneyState): { allowed: boolean; reason?: string } {
  // Official verification is a safe, user-initiated check (vision step 4); it is
  // available as soon as there are extracted claims to check, independent of phase.
  if (s.hasVerification || s.factsExtracted) return { allowed: true };
  return { allowed: false, reason: VERIFY_GUIDANCE };
}

function ownerStep(step: Step, s: JourneyState): StepStatus {
  switch (step) {
    case 'Plan': return { step, available: true };
    case 'Session': return s.planSaved ? { step, available: true } : { step, available: false, reason: 'Save your Safety Plan first.' };
    case 'Review': return s.caseId ? { step, available: true } : { step, available: false, reason: 'Start a controlled session first.' };
    case 'Decide':
    case 'Verify':
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
