import { Button, Card } from './ui';

export interface CasesScreenProps {
  /** The case currently open in this session, if any. */
  currentCaseId?: string;
  /** Resume / open the current case flow. */
  onOpenCurrent?: () => void;
  /** Start a fresh protected session. */
  onStartSession: () => void;
}

/**
 * The persistent record of handled cases (founder vision). A full stored
 * history is backlog (DSN-029); for now this surfaces the session's current
 * case and the entry point to a new one, establishing the information
 * architecture without inventing data.
 */
export function CasesScreen({ currentCaseId, onOpenCurrent, onStartSession }: CasesScreenProps): React.JSX.Element {
  return (
    <section aria-label="Cases">
      <Card
        title="Your cases"
        footer={
          <Button size="lg" onClick={onStartSession}>
            Start a protected session
          </Button>
        }
      >
        {currentCaseId ? (
          <button
            type="button"
            onClick={onOpenCurrent}
            className="flex w-full items-center justify-between gap-space-3 rounded-md border border-border p-space-3 text-left hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="flex flex-col">
              <span className="font-semibold">Current case</span>
              <span className="text-sm text-text-muted">Open the case you&apos;re working on</span>
            </span>
            <span aria-hidden="true" className="text-text-muted">›</span>
          </button>
        ) : (
          <p className="text-text-muted">
            No cases yet. When you handle a call, it is saved here so you can revisit the facts, evidence, and next steps.
          </p>
        )}
      </Card>
    </section>
  );
}
