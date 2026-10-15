import type { Step, StepStatus } from '../journey';

export interface StepRailProps {
  steps: StepStatus[];
  current: Step;
  onSelect: (s: Step) => void;
}

/**
 * Compact horizontal progress stepper: one small numbered circle per journey step
 * connected by a thin line — completed steps show a check, the current step is ringed,
 * upcoming/locked steps are muted outlines. It deliberately shows no step labels (they
 * dominated the screen); the step name is the button's accessible name (and its tooltip),
 * and the Back/Next footer below names the adjacent steps in words.
 */
export function StepRail({ steps, current, onSelect }: StepRailProps) {
  const currentIdx = steps.findIndex((s) => s.step === current);
  return (
    <nav aria-label="Journey">
      <ol className="flex items-center">
        {steps.map(({ step, available, reason }, i) => {
          const isCurrent = step === current;
          const isDone = currentIdx >= 0 && i < currentIdx;
          const circle = isDone
            ? 'border-primary bg-primary text-primary-contrast'
            : isCurrent
              ? 'border-primary bg-surface-raised text-primary ring-2 ring-primary/30'
              : 'border-border bg-surface-raised text-text-muted';
          return (
            <li key={step} className="flex min-w-0 flex-1 items-center last:flex-none">
              <button
                type="button"
                disabled={!available}
                aria-current={isCurrent ? 'step' : undefined}
                title={available ? step : reason ? `${step} — locked: ${reason}` : step}
                onClick={() => onSelect(step)}
                className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${circle}`}
                >
                  {isDone ? '✓' : i + 1}
                </span>
                <span className="sr-only">
                  {step}
                  {isCurrent ? ' (current)' : !available ? ` (locked: ${reason ?? 'unavailable'})` : ''}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span aria-hidden="true" className={`mx-space-1 h-0.5 flex-1 rounded-full ${isDone ? 'bg-primary' : 'bg-border'}`} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
