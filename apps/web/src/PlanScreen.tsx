import { useId, useState } from 'react';
import type { RetentionMode } from '../../../packages/contracts/src/plan';
import { Badge, Button, Card, Field } from './ui';

/** Readiness is a separate signal from nomination: an unaccepted invitation is never "ready". */
export type AllyStatus = 'none' | 'invited' | 'ready';

export interface PlanFormValues {
  thresholdMinor: number;
  bankId: 'demo-bank';
  processingConsent: boolean;
  retentionMode: RetentionMode;
  allySharingConsent: boolean;
  exportConsent: boolean;
}

export interface PlanScreenProps {
  role: 'owner' | 'ally';
  /** Owner view: the previously saved plan, if any, used to prefill the form. */
  plan?: PlanFormValues;
  /** Owner view: readiness is independent of `plan.nominatedAllyUid` - a nomination is not readiness until accepted. */
  allyStatus?: AllyStatus;
  allyName?: string;
  onSavePlan?: (values: PlanFormValues & { allyPairingCode?: string }) => void;
  /** Ally view: the pairing code just issued for this session, if any. */
  pairingCode?: string | null;
  onRequestPairingCode?: () => void;
  onAcceptInvitation?: () => void;
}

const DEFAULT_VALUES: PlanFormValues = {
  thresholdMinor: 500_000,
  bankId: 'demo-bank',
  processingConsent: false,
  retentionMode: 'facts-24h',
  allySharingConsent: false,
  exportConsent: false,
};

const INPUT_CLASS =
  'rounded-md border border-border bg-surface px-space-3 py-space-2 text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const CHOICE_CLASS = 'flex items-start gap-space-2 text-text';

/** Converts a human-entered rupee amount to minor currency units (paise). */
function toMinorUnits(rupees: string): number {
  const value = Number(rupees);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function fromMinorUnits(minor: number): string {
  return String(Math.round(minor / 100));
}

export function PlanScreen(props: PlanScreenProps): React.JSX.Element {
  if (props.role === 'ally') {
    return <AllyPairingView {...props} />;
  }
  return <OwnerPlanView {...props} />;
}

function OwnerPlanView({
  plan,
  allyStatus = 'none',
  allyName = 'your Safety Ally',
  onSavePlan,
}: PlanScreenProps): React.JSX.Element {
  const initial = plan ?? DEFAULT_VALUES;
  const [thresholdRupees, setThresholdRupees] = useState(fromMinorUnits(initial.thresholdMinor));
  const [processingConsent, setProcessingConsent] = useState(initial.processingConsent);
  const [retentionMode, setRetentionMode] = useState<RetentionMode>(initial.retentionMode);
  const [allySharingConsent, setAllySharingConsent] = useState(initial.allySharingConsent);
  const [exportConsent, setExportConsent] = useState(initial.exportConsent);
  const [allyPairingCode, setAllyPairingCode] = useState('');

  const thresholdId = useId();
  const pairingCodeId = useId();

  function handleSave(): void {
    onSavePlan?.({
      thresholdMinor: toMinorUnits(thresholdRupees),
      bankId: 'demo-bank',
      processingConsent,
      retentionMode,
      allySharingConsent,
      exportConsent,
      ...(allyPairingCode ? { allyPairingCode } : {}),
    });
  }

  return (
    <section aria-label="My saved Safety Plan">
      <Card
        title="My saved Safety Plan"
        footer={
          <Button variant="primary" onClick={handleSave}>
            Save Safety Plan
          </Button>
        }
      >
        <p className="text-text-muted">Only intervene strongly when a live claim meets a consequential action.</p>

        <Field label="Large new-payee threshold" htmlFor={thresholdId}>
          <input
            id={thresholdId}
            type="number"
            inputMode="numeric"
            className={INPUT_CLASS}
            value={thresholdRupees}
            onChange={(event) => setThresholdRupees(event.target.value)}
          />
        </Field>

        <div className="flex flex-col gap-space-1">
          <h3 className="font-semibold">Independent bank route</h3>
          <p>
            <Badge tone="simulated">Simulated</Badge> Demo Bank &middot; fictional verification registry
          </p>
          <p>Never use a number provided by the caller.</p>
        </div>

        <div className="flex flex-col gap-space-2">
          <h3 className="font-semibold">Safety Ally</h3>
          {allyStatus === 'none' && <p>No Safety Ally nominated yet.</p>}
          {allyStatus === 'invited' && <p>{allyName} &middot; nominated, awaiting acceptance</p>}
          {allyStatus === 'ready' && (
            <p>
              {allyName} &middot; invitation accepted &mdash; <strong>ready to ask</strong>
            </p>
          )}
          <p className="text-text-muted">No case detail is shared until you explicitly ask this ally.</p>
          <Field label="Ally pairing code" htmlFor={pairingCodeId}>
            <input
              id={pairingCodeId}
              type="text"
              className={INPUT_CLASS}
              value={allyPairingCode}
              onChange={(event) => setAllyPairingCode(event.target.value)}
              placeholder="Enter the code your ally shared with you"
            />
          </Field>
        </div>

        <fieldset className="flex flex-col gap-space-3 rounded-md border border-border p-space-3">
          <legend className="px-space-1 font-semibold">My data choices</legend>
          <p className="text-text-muted">Each choice below is separately granted and revocable.</p>

          <label className={CHOICE_CLASS}>
            <input
              type="checkbox"
              checked={processingConsent}
              onChange={(event) => setProcessingConsent(event.target.checked)}
            />
            Allow processing this controlled session (live transcript segments + Gemini inference)
          </label>

          <fieldset className="flex flex-col gap-space-2 rounded-md border border-border p-space-3">
            <legend className="px-space-1 font-semibold">Keep after the session</legend>
            <label className={CHOICE_CLASS}>
              <input
                type="radio"
                name="retentionMode"
                value="delete-on-close"
                checked={retentionMode === 'delete-on-close'}
                onChange={() => setRetentionMode('delete-on-close')}
              />
              Delete case content at close
            </label>
            <p className="text-sm text-text-muted">Deleting at close prevents later no-reentry recovery.</p>
            <label className={CHOICE_CLASS}>
              <input
                type="radio"
                name="retentionMode"
                value="facts-24h"
                checked={retentionMode === 'facts-24h'}
                onChange={() => setRetentionMode('facts-24h')}
              />
              Confirmed facts &middot; up to 24 hours
            </label>
            <p className="text-sm text-text-muted">Default &middot; no raw transcript retained.</p>
            <label className={CHOICE_CLASS}>
              <input
                type="radio"
                name="retentionMode"
                value="selected-7d"
                checked={retentionMode === 'selected-7d'}
                onChange={() => setRetentionMode('selected-7d')}
              />
              Selected excerpts + facts &middot; up to 7 days
            </label>
          </fieldset>

          <label className={CHOICE_CLASS}>
            <input
              type="checkbox"
              checked={allySharingConsent}
              onChange={(event) => setAllySharingConsent(event.target.checked)}
            />
            Allow ally sharing (case-specific permission is still required later)
          </label>

          <label className={CHOICE_CLASS}>
            <input
              type="checkbox"
              checked={exportConsent}
              onChange={(event) => setExportConsent(event.target.checked)}
            />
            Allow evidence export (a reviewable file, never an automatic report)
          </label>
        </fieldset>
      </Card>
    </section>
  );
}

function AllyPairingView({
  pairingCode,
  onRequestPairingCode,
  onAcceptInvitation,
}: PlanScreenProps): React.JSX.Element {
  return (
    <section aria-label="Safety Ally pairing">
      <Card title="Pair as a Safety Ally">
        <div>
          <Button variant="secondary" onClick={() => onRequestPairingCode?.()}>
            Get pairing code
          </Button>
        </div>
        {pairingCode && (
          <p>
            Share this code with the person who invited you: <strong data-testid="pairing-code">{pairingCode}</strong>
          </p>
        )}
        <div>
          <Button variant="primary" onClick={() => onAcceptInvitation?.()}>
            Accept invitation
          </Button>
        </div>
      </Card>
    </section>
  );
}
