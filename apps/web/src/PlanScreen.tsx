import { useId, useState } from 'react';
import type { RetentionMode } from '../../../packages/contracts/src/plan';

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
      <h2>My saved Safety Plan</h2>
      <p>Only intervene strongly when a live claim meets a consequential action.</p>

      <div>
        <label htmlFor={thresholdId}>Large new-payee threshold</label>
        <input
          id={thresholdId}
          type="number"
          inputMode="numeric"
          value={thresholdRupees}
          onChange={(event) => setThresholdRupees(event.target.value)}
        />
      </div>

      <div>
        <h3>Independent bank route</h3>
        <p>Demo Bank &middot; fictional verification registry</p>
        <p>Never use a number provided by the caller.</p>
      </div>

      <div>
        <h3>Safety Ally</h3>
        {allyStatus === 'none' && <p>No Safety Ally nominated yet.</p>}
        {allyStatus === 'invited' && <p>{allyName} &middot; nominated, awaiting acceptance</p>}
        {allyStatus === 'ready' && (
          <p>
            {allyName} &middot; invitation accepted &mdash; <strong>ready to ask</strong>
          </p>
        )}
        <p>No case detail is shared until you explicitly ask this ally.</p>
        <label htmlFor={pairingCodeId}>Ally pairing code</label>
        <input
          id={pairingCodeId}
          type="text"
          value={allyPairingCode}
          onChange={(event) => setAllyPairingCode(event.target.value)}
          placeholder="Enter the code your ally shared with you"
        />
      </div>

      <fieldset>
        <legend>My data choices</legend>
        <p>Each choice below is separately granted and revocable.</p>

        <label>
          <input
            type="checkbox"
            checked={processingConsent}
            onChange={(event) => setProcessingConsent(event.target.checked)}
          />
          Allow processing this controlled session (live transcript segments + Gemini inference)
        </label>

        <fieldset>
          <legend>Keep after the session</legend>
          <label>
            <input
              type="radio"
              name="retentionMode"
              value="delete-on-close"
              checked={retentionMode === 'delete-on-close'}
              onChange={() => setRetentionMode('delete-on-close')}
            />
            Delete case content at close
          </label>
          <p>Deleting at close prevents later no-reentry recovery.</p>
          <label>
            <input
              type="radio"
              name="retentionMode"
              value="facts-24h"
              checked={retentionMode === 'facts-24h'}
              onChange={() => setRetentionMode('facts-24h')}
            />
            Confirmed facts &middot; up to 24 hours
          </label>
          <p>Default &middot; no raw transcript retained.</p>
          <label>
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

        <label>
          <input
            type="checkbox"
            checked={allySharingConsent}
            onChange={(event) => setAllySharingConsent(event.target.checked)}
          />
          Allow ally sharing (case-specific permission is still required later)
        </label>

        <label>
          <input
            type="checkbox"
            checked={exportConsent}
            onChange={(event) => setExportConsent(event.target.checked)}
          />
          Allow evidence export (a reviewable file, never an automatic report)
        </label>
      </fieldset>

      <button type="button" onClick={handleSave}>
        Save Safety Plan
      </button>
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
      <h2>Pair as a Safety Ally</h2>
      <button type="button" onClick={() => onRequestPairingCode?.()}>
        Get pairing code
      </button>
      {pairingCode && (
        <p>
          Share this code with the person who invited you: <strong data-testid="pairing-code">{pairingCode}</strong>
        </p>
      )}
      <button type="button" onClick={() => onAcceptInvitation?.()}>
        Accept invitation
      </button>
    </section>
  );
}
