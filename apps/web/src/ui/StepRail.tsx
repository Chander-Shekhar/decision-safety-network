import type { Step, StepStatus } from '../journey';

export interface StepRailProps {
  steps: StepStatus[];
  current: Step;
  onSelect: (s: Step) => void;
}

export function StepRail({ steps, current, onSelect }: StepRailProps) {
  return (
    <nav aria-label="Journey">
      <ol className="flex flex-col gap-space-1">
        {steps.map(({ step, available, reason }, i) => {
          const isCurrent = step === current;
          return (
            <li key={step} className="flex flex-col">
              <button
                type="button"
                disabled={!available}
                aria-current={isCurrent ? 'step' : undefined}
                title={!available ? reason : undefined}
                onClick={() => onSelect(step)}
                className={`flex items-center gap-space-2 rounded-md border-l-4 px-space-3 py-space-2 text-left text-base text-text hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${isCurrent ? 'border-primary bg-surface-sunken font-semibold' : 'border-transparent'}`}
              >
                <span aria-hidden="true">{i + 1}.</span>
                <span>{step}</span>
                {isCurrent && <span className="sr-only">(current)</span>}
              </button>
              {!available && reason && <span className="px-space-3 text-xs text-text-muted">Locked: {reason}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
