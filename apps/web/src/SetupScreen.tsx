import { useId, useState } from 'react';
import {
  ALLY_SHARE_FIELDS,
  DEFAULT_ALLY_SHARE_FIELDS,
  type AllyShareField,
  type CallListeningMode,
  type RegisteredBankAccount,
} from '../../../packages/contracts/src/plan';
import { Button, Card, Field } from './ui';

/** What first-run setup collects; the rest of the Safety Plan keeps its defaults. */
export interface SetupValues {
  callListening: CallListeningMode;
  processingConsent: boolean;
  allySharingConsent: boolean;
  allyShareFields: AllyShareField[];
  bankAccounts: RegisteredBankAccount[];
  allyPairingCode?: string;
}

export interface SetupScreenProps {
  initial?: Partial<SetupValues>;
  saving?: boolean;
  onComplete: (values: SetupValues) => void;
}

const LISTENING_OPTIONS: { value: CallListeningMode; title: string; detail: string }[] = [
  { value: 'all-calls', title: 'All calls', detail: 'Listen for scam patterns on every incoming call.' },
  { value: 'unverified-only', title: 'Unverified numbers only', detail: 'Skip numbers you have already verified.' },
  { value: 'per-call', title: 'Decide per call at pickup', detail: 'You choose each time. The most private option.' },
];

const SHARE_LABELS: Record<AllyShareField, string> = {
  claim: 'What the caller claims',
  proposedAction: 'What they asked me to do',
  amount: 'The amount involved',
  verificationGap: 'What has not been verified yet',
  selectedEvidence: 'Selected evidence excerpts',
};

const STEP_TITLES = ['Call listening', 'Your Safety Ally', 'Your accounts'] as const;
const INPUT_CLASS =
  'rounded-md border border-border bg-surface px-space-3 py-space-2 text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const CHOICE_CLASS = 'flex items-start gap-space-2 text-text';
const DEFAULT_ACCOUNT: RegisteredBankAccount = { id: 'demo-savings', label: 'Demo Bank Savings', last4: '4821' };

export function SetupScreen({ initial, saving = false, onComplete }: SetupScreenProps): React.JSX.Element {
  const [step, setStep] = useState(0);
  const [callListening, setCallListening] = useState<CallListeningMode | null>(initial?.callListening ?? null);
  const [processingConsent, setProcessingConsent] = useState(initial?.processingConsent ?? false);
  const [allySharingConsent, setAllySharingConsent] = useState(initial?.allySharingConsent ?? true);
  const [shareFields, setShareFields] = useState<AllyShareField[]>(initial?.allyShareFields ?? [...DEFAULT_ALLY_SHARE_FIELDS]);
  const [pairingCode, setPairingCode] = useState('');
  const [accounts, setAccounts] = useState<RegisteredBankAccount[]>(initial?.bankAccounts?.length ? initial.bankAccounts : [DEFAULT_ACCOUNT]);
  const [label, setLabel] = useState('');
  const [last4, setLast4] = useState('');

  const pairingId = useId();
  const labelId = useId();
  const last4Id = useId();

  const canAdd = label.trim().length > 0 && /^\d{4}$/.test(last4) && accounts.length < 5;
  const canContinue = step === 0 ? callListening !== null : step === 2 ? accounts.length > 0 : true;
  const last = step === STEP_TITLES.length - 1;

  function addAccount(): void {
    if (!canAdd) return;
    setAccounts([...accounts, { id: `acct-${Date.now().toString(36)}-${accounts.length}`, label: label.trim(), last4 }]);
    setLabel('');
    setLast4('');
  }

  function toggleField(field: AllyShareField): void {
    setShareFields((prev) => (prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]));
  }

  function finish(): void {
    if (callListening === null) return;
    onComplete({
      callListening,
      processingConsent,
      allySharingConsent,
      allyShareFields: ALLY_SHARE_FIELDS.filter((f) => shareFields.includes(f)),
      bankAccounts: accounts,
      ...(pairingCode.trim() ? { allyPairingCode: pairingCode.trim() } : {}),
    });
  }

  return (
    <section aria-label="First-run setup" className="mx-auto w-full max-w-2xl">
      <Card
        title={
          <>
            <span className="block text-sm font-medium text-text-muted">
              Step {step + 1} of {STEP_TITLES.length}
            </span>
            {STEP_TITLES[step]}
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-space-3">
            {last ? (
              <Button size="lg" onClick={finish} disabled={!canContinue || saving}>
                {saving ? 'Saving…' : 'Finish setup'}
              </Button>
            ) : (
              <Button size="lg" onClick={() => setStep(step + 1)} disabled={!canContinue}>
                Continue
              </Button>
            )}
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={saving}>
                Back
              </Button>
            )}
          </div>
        }
      >
        {step === 0 && (
          <>
            <p className="text-text-muted">Choose when Decision Safety Network should listen for scam patterns during a call.</p>
            <fieldset className="flex flex-col gap-space-2">
              <legend className="sr-only">Call listening</legend>
              {LISTENING_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`${CHOICE_CLASS} rounded-md border p-space-3 ${callListening === option.value ? 'border-primary bg-surface-sunken' : 'border-border'}`}
                >
                  <input
                    type="radio"
                    name="callListening"
                    value={option.value}
                    checked={callListening === option.value}
                    onChange={() => setCallListening(option.value)}
                  />
                  <span className="flex flex-col">
                    <span className="font-semibold">{option.title}</span>
                    <span className="text-sm text-text-muted">{option.detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className={CHOICE_CLASS}>
              <input type="checkbox" checked={processingConsent} onChange={(e) => setProcessingConsent(e.target.checked)} />
              <span>
                Allow processing of call transcripts I choose to have listened to
                <span className="block text-sm text-text-muted">Separate from every other choice, and you can revoke it any time.</span>
              </span>
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-text-muted">
              A Safety Ally is someone you trust to help you think when something feels wrong. Nothing is shared until you review and approve it for a specific case.
            </p>
            <Field label="Ally pairing code (optional)" htmlFor={pairingId} hint="Ask your ally for their code, or add it later from your Safety Plan.">
              <input id={pairingId} type="text" className={INPUT_CLASS} value={pairingCode} onChange={(e) => setPairingCode(e.target.value)} />
            </Field>
            <label className={CHOICE_CLASS}>
              <input type="checkbox" checked={allySharingConsent} onChange={(e) => setAllySharingConsent(e.target.checked)} />
              Allow ally sharing
            </label>
            <fieldset className="flex flex-col gap-space-2 rounded-md border border-border p-space-3" disabled={!allySharingConsent}>
              <legend className="px-space-1 font-semibold">What my ally can be shown</legend>
              {ALLY_SHARE_FIELDS.map((field) => (
                <label key={field} className={CHOICE_CLASS}>
                  <input type="checkbox" checked={shareFields.includes(field)} onChange={() => toggleField(field)} />
                  {SHARE_LABELS[field]}
                </label>
              ))}
            </fieldset>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-text-muted">Register the accounts you want guided protection for if a scam involves your bank.</p>
            <ul aria-label="Registered accounts" className="flex flex-col gap-space-2">
              {accounts.map((account) => (
                <li key={account.id} className="flex items-center justify-between gap-space-3 rounded-md border border-border p-space-3">
                  <span>
                    <span className="font-semibold">{account.label}</span> &middot; ending {account.last4}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setAccounts(accounts.filter((a) => a.id !== account.id))}>
                    Remove {account.label}
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-end gap-space-3">
              <Field label="Account nickname" htmlFor={labelId}>
                <input id={labelId} type="text" className={INPUT_CLASS} value={label} onChange={(e) => setLabel(e.target.value)} />
              </Field>
              <Field label="Last 4 digits" htmlFor={last4Id}>
                <input
                  id={last4Id}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  className={INPUT_CLASS}
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                />
              </Field>
              <Button variant="secondary" onClick={addAccount} disabled={!canAdd}>
                Add account
              </Button>
            </div>
            <p className="text-sm text-text-muted">Demo accounts only &mdash; nothing here connects to a real bank.</p>
          </>
        )}
      </Card>
    </section>
  );
}
