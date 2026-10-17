import { useId, useState } from 'react';
import {
  ALLY_SHARE_FIELDS,
  DEFAULT_ALLY_SHARE_FIELDS,
  type AllyShareField,
  type CallListeningMode,
  type RegisteredBankAccount,
  type RetentionMode,
} from '../../../packages/contracts/src/plan';
import type { UserProfile } from '../../../packages/contracts/src/profile';
import { ProfileForm } from './ProfileForm';
import { Button, Card, Disclosure, Field } from './ui';

/** Everything the consolidated Settings surface can change; App maps it onto `PUT plan`. */
export interface SettingsValues {
  callListening: CallListeningMode;
  processingConsent: boolean;
  allySharingConsent: boolean;
  allyShareFields: AllyShareField[];
  bankAccounts: RegisteredBankAccount[];
  thresholdMinor: number;
  retentionMode: RetentionMode;
  exportConsent: boolean;
  allyPairingCode?: string;
}

export interface SettingsScreenProps {
  initial?: Partial<SettingsValues>;
  /** Readiness of the owner's Safety Ally. */
  allyStatus: 'none' | 'invited' | 'ready';
  /** The paired ally's own name, when they have set one. */
  allyName?: string;
  /** The owner's own details, edited in a separate "Your details" card. */
  profile?: UserProfile;
  profileSaved?: boolean;
  onSaveProfile?: (profile: UserProfile) => void;
  saving?: boolean;
  /** True once a save in this session has succeeded (drives the confirmation). */
  saved?: boolean;
  onSave: (values: SettingsValues) => void;
}

const LISTENING_OPTIONS: { value: CallListeningMode; title: string; detail: string }[] = [
  { value: 'all-calls', title: 'All calls', detail: 'Watch for scam patterns on every incoming call.' },
  { value: 'unverified-only', title: 'Unverified numbers only', detail: 'Skip numbers you have already verified.' },
  { value: 'per-call', title: 'Decide at each call', detail: 'You choose every time. The most private option.' },
];

const SHARE_LABELS: Record<AllyShareField, string> = {
  claim: 'What the caller claims',
  proposedAction: 'What they asked me to do',
  amount: 'The amount involved',
  verificationGap: 'What has not been verified yet',
  summary: 'A short AI summary of the call',
};

const RETENTION_OPTIONS: { value: RetentionMode; title: string; detail: string }[] = [
  { value: 'delete-on-close', title: 'Delete at close', detail: 'Nothing kept after the session. Prevents later recovery.' },
  { value: 'facts-24h', title: 'Confirmed facts · 24 hours', detail: 'Default. No raw transcript kept.' },
  { value: 'selected-7d', title: 'Selected excerpts + facts · 7 days', detail: 'Keep chosen excerpts a little longer.' },
];

const INPUT_CLASS =
  'rounded-md border border-border bg-surface px-space-3 py-space-2 text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const CHOICE_CLASS = 'flex items-start gap-space-2 text-text';

function toMinorUnits(rupees: string): number {
  const value = Number(rupees);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
function fromMinorUnits(minor: number): string {
  return String(Math.round(minor / 100));
}

/**
 * One place to set up everything the app actually uses: who to listen to,
 * your Safety Ally, the accounts you want guided protection for, and whether
 * processing is allowed. The less common privacy controls live under an
 * Advanced section so first-time setup stays short. Saving completes setup.
 */
export function SettingsScreen({
  initial,
  allyStatus,
  allyName,
  profile,
  profileSaved = false,
  onSaveProfile,
  saving = false,
  saved = false,
  onSave,
}: SettingsScreenProps): React.JSX.Element {
  const [callListening, setCallListening] = useState<CallListeningMode>(initial?.callListening ?? 'per-call');
  const [processingConsent, setProcessingConsent] = useState(initial?.processingConsent ?? true);
  const [allySharingConsent, setAllySharingConsent] = useState(initial?.allySharingConsent ?? true);
  const [shareFields, setShareFields] = useState<AllyShareField[]>(initial?.allyShareFields ?? [...DEFAULT_ALLY_SHARE_FIELDS]);
  const [accounts, setAccounts] = useState<RegisteredBankAccount[]>(
    initial?.bankAccounts?.length ? initial.bankAccounts : [{ id: 'everyday-savings', label: 'Everyday Savings', last4: '4821' }],
  );
  const [thresholdRupees, setThresholdRupees] = useState(fromMinorUnits(initial?.thresholdMinor ?? 500_000));
  const [retentionMode, setRetentionMode] = useState<RetentionMode>(initial?.retentionMode ?? 'facts-24h');
  const [exportConsent, setExportConsent] = useState(initial?.exportConsent ?? false);
  const [pairingCode, setPairingCode] = useState('');
  const [label, setLabel] = useState('');
  const [last4, setLast4] = useState('');

  const pairingId = useId();
  const labelId = useId();
  const last4Id = useId();
  const thresholdId = useId();

  const canAdd = label.trim().length > 0 && /^\d{4}$/.test(last4) && accounts.length < 5;

  function addAccount(): void {
    if (!canAdd) return;
    setAccounts([...accounts, { id: `acct-${Date.now().toString(36)}-${accounts.length}`, label: label.trim(), last4 }]);
    setLabel('');
    setLast4('');
  }
  function toggleField(field: AllyShareField): void {
    setShareFields((prev) => (prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]));
  }
  function save(): void {
    onSave({
      callListening,
      processingConsent,
      allySharingConsent,
      allyShareFields: ALLY_SHARE_FIELDS.filter((f) => shareFields.includes(f)),
      bankAccounts: accounts,
      thresholdMinor: toMinorUnits(thresholdRupees),
      retentionMode,
      exportConsent,
      ...(pairingCode.trim() ? { allyPairingCode: pairingCode.trim() } : {}),
    });
  }

  const who = allyName ?? 'Your Safety Ally';
  const allyStatusText =
    allyStatus === 'ready'
      ? `${who} · ready to help`
      : allyStatus === 'invited'
        ? `${who} · invited, awaiting acceptance`
        : 'No ally connected yet';

  return (
    <section aria-label="Settings" className="flex flex-col gap-space-4">
      {onSaveProfile && (
        <ProfileForm
          initial={profile}
          saved={profileSaved}
          hint="So your Safety Ally sees your name, and you can see theirs."
          onSave={onSaveProfile}
        />
      )}
      <Card
        title="Settings"
        footer={
          <div className="flex flex-wrap items-center gap-space-3">
            <Button size="lg" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
            {saved && !saving && (
              <span role="status" className="text-sm text-safe">
                Saved.
              </span>
            )}
          </div>
        }
      >
        {/* Call listening */}
        <fieldset className="flex flex-col gap-space-2">
          <legend className="font-semibold">When to listen</legend>
          <p className="text-sm text-text-muted">Choose when we watch for scam patterns during a call.</p>
          {LISTENING_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`${CHOICE_CLASS} rounded-md border p-space-3 ${
                callListening === option.value ? 'border-primary bg-surface-sunken' : 'border-border'
              }`}
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
          <label className={CHOICE_CLASS}>
            <input type="checkbox" checked={processingConsent} onChange={(e) => setProcessingConsent(e.target.checked)} />
            <span>
              Allow processing of the calls I choose to have listened to
              <span className="block text-sm text-text-muted">You can turn this off at any time.</span>
            </span>
          </label>
        </fieldset>

        {/* Safety Ally */}
        <fieldset className="flex flex-col gap-space-2 rounded-md border border-border p-space-3">
          <legend className="px-space-1 font-semibold">Safety Ally</legend>
          <p className="text-sm text-text-muted">
            Someone you trust to help you think when something feels wrong. Nothing is shared until you review and
            approve it for a specific case.
          </p>
          <p className="font-semibold">{allyStatusText}</p>
          <Field label="Connect your own ally (optional)" htmlFor={pairingId} hint="Enter the pairing code your ally shared with you.">
            <input id={pairingId} type="text" className={INPUT_CLASS} value={pairingCode} onChange={(e) => setPairingCode(e.target.value)} />
          </Field>
        </fieldset>

        {/* Protected accounts */}
        <fieldset className="flex flex-col gap-space-2">
          <legend className="font-semibold">Protected accounts</legend>
          <p className="text-sm text-text-muted">Accounts you want guided protection for if a scam involves your bank.</p>
          <ul aria-label="Registered accounts" className="flex flex-col gap-space-2">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-space-3 rounded-md border border-border p-space-3">
                <span>
                  <span className="font-semibold">{account.label}</span> · ending {account.last4}
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
        </fieldset>

        {/* Advanced */}
        <Disclosure summary="Advanced (optional)">
          <div className="flex flex-col gap-space-4">
            <Field label="Large new-payee threshold (₹)" htmlFor={thresholdId} hint="We only intervene strongly above this amount.">
              <input
                id={thresholdId}
                type="number"
                inputMode="numeric"
                className={INPUT_CLASS}
                value={thresholdRupees}
                onChange={(e) => setThresholdRupees(e.target.value)}
              />
            </Field>

            <fieldset className="flex flex-col gap-space-2">
              <legend className="font-semibold">Keep after the session</legend>
              {RETENTION_OPTIONS.map((option) => (
                <label key={option.value} className={CHOICE_CLASS}>
                  <input
                    type="radio"
                    name="retentionMode"
                    value={option.value}
                    checked={retentionMode === option.value}
                    onChange={() => setRetentionMode(option.value)}
                  />
                  <span className="flex flex-col">
                    <span>{option.title}</span>
                    <span className="text-sm text-text-muted">{option.detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="flex flex-col gap-space-2" disabled={!allySharingConsent}>
              <legend className="font-semibold">
                <label className={`${CHOICE_CLASS} font-semibold`}>
                  <input
                    type="checkbox"
                    disabled={false}
                    checked={allySharingConsent}
                    onChange={(e) => setAllySharingConsent(e.target.checked)}
                  />
                  Allow ally sharing
                </label>
              </legend>
              <p className="pl-space-5 text-sm text-text-muted">Case-specific approval is still required each time.</p>
              {ALLY_SHARE_FIELDS.map((field) => (
                <label key={field} className={`${CHOICE_CLASS} pl-space-5`}>
                  <input type="checkbox" checked={shareFields.includes(field)} onChange={() => toggleField(field)} />
                  {SHARE_LABELS[field]}
                </label>
              ))}
            </fieldset>

            <label className={CHOICE_CLASS}>
              <input type="checkbox" checked={exportConsent} onChange={(e) => setExportConsent(e.target.checked)} />
              Allow evidence export (a reviewable file, never an automatic report)
            </label>
          </div>
        </Disclosure>
      </Card>
    </section>
  );
}
