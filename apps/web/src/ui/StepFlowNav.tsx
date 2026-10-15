import type { Step, StepStatus } from '../journey';
import { Button } from './Button';

export interface StepFlowNavProps {
  /** The journey steps in order (same list the StepRail is given). */
  steps: StepStatus[];
  current: Step;
  onSelect: (s: Step) => void;
}

/**
 * The sequential companion to StepRail: a Back / Next footer that moves one
 * step at a time through the journey, so the flow reads as discrete steps with
 * obvious forward/back rather than a single long page. The StepRail stays as
 * the overview and lets the user jump; this is the linear path.
 *
 * "Next" is disabled (with the lock reason shown) until the next step's
 * prerequisite is met, so you can never advance past a gate. "Back" always
 * returns to the previous step.
 */
export function StepFlowNav({ steps, current, onSelect }: StepFlowNavProps): React.JSX.Element | null {
  const idx = steps.findIndex((s) => s.step === current);
  if (idx < 0) return null;
  const prev = steps[idx - 1];
  const next = steps[idx + 1];

  return (
    <nav
      aria-label="Step navigation"
      className="flex items-center justify-between gap-space-3 border-t border-border pt-space-4"
    >
      <div className="min-w-0">
        {prev && (
          <Button variant="secondary" onClick={() => onSelect(prev.step)}>
            <span aria-hidden="true">←</span> Back to {prev.step}
          </Button>
        )}
      </div>

      <p className="text-xs text-text-muted whitespace-nowrap">
        Step {idx + 1} of {steps.length}
      </p>

      <div className="flex min-w-0 flex-col items-end gap-space-1">
        {next && (
          <>
            <Button onClick={() => onSelect(next.step)} disabled={!next.available}>
              Next: {next.step} <span aria-hidden="true">→</span>
            </Button>
            {!next.available && next.reason && (
              <span className="text-right text-xs text-text-muted">{next.reason}</span>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
