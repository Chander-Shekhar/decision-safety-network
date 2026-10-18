import { useState } from 'react';
import { ActionBar, Button, Card } from './ui';
import type { RecoveryState } from '../../../packages/contracts/src/recovery';
import type { OfficialContact } from '../../../packages/contracts/src/official-contact';

/** Details the owner typed. Blank optional fields are omitted, never sent as empty strings. */
export interface EditedPaidDetails {
  paidPayee: string;
  paidAmountMinor: number;
  transactionTime?: string;
  paymentRail?: string;
  referenceId?: string;
}

export interface RecoveryScreenProps {
  state: RecoveryState;
  /** Owner tapped "Yes, they match"; receives the exact fingerprint of the prefill shown. */
  onMatch?: (fingerprint: string) => void;
  onEdit?: (details: EditedPaidDetails) => void;
  /** The number found on the Decide step; when present it is the bank/organisation call link. */
  officialContact?: OfficialContact | null;
  /** True once the owner opened the official portal; never means a report was filed or accepted. */
  reportHandedOff?: boolean;
  /** The caller's number was captured at the start; reporting also adds it to the owner's private warn list. */
  callerKnown?: boolean;
  onOpenReport?: () => void;
  onDownloadReport?: () => void;
  onDownloadEvidence?: () => void;
}

const HEARD_LABELS: Record<string, string> = {
  claimedIdentity: 'Who they said they were',
  centralClaim: 'What they told you',
  requestedAction: 'What they asked you to do',
  payee: 'Where they wanted the money sent',
  amount: 'How much they asked for',
  deadline: 'How soon they said you must act',
};

const INPUT_CLASS =
  'rounded-md border border-border bg-surface-raised px-space-3 py-space-2 text-base text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function formatRupees(amountMinor: number): string {
  return `₹${(amountMinor / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Whole rupees with up to two decimals -> minor units; null if the text is not a positive amount. */
function parseRupeesToMinor(text: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/** Strips spaces/punctuation so a `tel:` link dials; keeps a leading +. */
function dialable(number: string): string {
  return number.replace(/(?!^\+)[^\d]/g, '');
}

/**
 * "I already paid" recovery screen. Calm, ordered: call the bank (with a
 * ready-to-read script), report to 1930, review what the call said, confirm
 * what was paid. Presentational only; the API owns all data. Nothing here
 * claims a call, freeze, or report happened.
 */
export function RecoveryScreen({ state, onMatch, onEdit, officialContact, reportHandedOff, callerKnown, onOpenReport, onDownloadReport, onDownloadEvidence }: RecoveryScreenProps): React.JSX.Element {
  const { proposedPayment, paidPayment, helpline1930Action, guidedFreeze } = state;
  const [editing, setEditing] = useState(false);
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionTime, setTransactionTime] = useState('');
  const [paymentRail, setPaymentRail] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showForm = !paidPayment && (editing || proposedPayment === null);
  const heardEntries = Object.entries(state.known.facts);
  const bankName = officialContact?.organisation ?? 'your bank';
  const bankNumber = officialContact?.phoneNumber ?? null;

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const minor = parseRupeesToMinor(amount);
    if (payee.trim() === '' || minor === null) {
      setError('Please enter who you paid and the amount, for example 12345.50.');
      return;
    }
    setError(null);
    const details: EditedPaidDetails = { paidPayee: payee.trim(), paidAmountMinor: minor };
    if (transactionTime.trim() !== '') details.transactionTime = transactionTime.trim();
    if (paymentRail.trim() !== '') details.paymentRail = paymentRail.trim();
    if (referenceId.trim() !== '') details.referenceId = referenceId.trim();
    onEdit?.(details);
  }

  return (
    <main aria-label="Recovery" className="mx-auto flex max-w-3xl flex-col gap-space-4 p-space-4 text-text">
      <h1 className="text-2xl font-semibold">Take a breath. You&apos;ve done the right thing by acting now.</h1>
      <p>Acting quickly gives you the best chance. Here is what to do, one step at a time.</p>

      <section aria-label="Call your bank">
        <Card title={`1. Call ${bankName} now`}>
          <p>Tell them you were scammed and ask them to hold the account you paid from.</p>
          {bankNumber ? (
            <ActionBar>
              <a
                href={`tel:${dialable(bankNumber)}`}
                className="inline-flex items-center justify-center rounded-md bg-primary px-space-4 py-space-3 text-base font-semibold text-white"
              >
                Call {bankName} · {bankNumber}
              </a>
            </ActionBar>
          ) : (
            <p>Use the helpline number on the back of your card or in your bank&apos;s app.</p>
          )}
          {guidedFreeze && (
            <>
              <h3 className="font-semibold">What you can say</h3>
              <pre className="whitespace-pre-wrap rounded-md bg-surface-sunken p-space-3 font-sans text-base">{guidedFreeze.script}</pre>
              <ActionBar>
                <Button variant="secondary" onClick={() => void navigator.clipboard?.writeText(guidedFreeze.script)}>
                  Copy script
                </Button>
              </ActionBar>
            </>
          )}
        </Card>
      </section>

      {heardEntries.length > 0 && (
        <section aria-label="What the caller said">
          <Card title="What the caller said">
            <p className="text-sm text-text-muted">Taken from the call you shared. Handy to have in front of you.</p>
            <dl className="flex flex-col gap-space-2">
              {heardEntries.map(([field, value]) => (
                <div key={field}>
                  <dt className="text-sm text-text-muted">{HEARD_LABELS[field] ?? field}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>
      )}

      <section aria-label="What you paid">
        <Card title="2. What you paid">
          {paidPayment ? (
            <>
              <p>Saved as you told us.</p>
              <dl className="flex flex-col gap-space-1">
                <dt className="text-sm text-text-muted">Paid to</dt>
                <dd>{paidPayment.paidPayee}</dd>
                <dt className="text-sm text-text-muted">Amount</dt>
                <dd>{formatRupees(paidPayment.paidAmountMinor)}</dd>
                {paidPayment.transactionTime && (
                  <>
                    <dt className="text-sm text-text-muted">When</dt>
                    <dd>{paidPayment.transactionTime}</dd>
                  </>
                )}
                {paidPayment.referenceId && (
                  <>
                    <dt className="text-sm text-text-muted">Reference ID</dt>
                    <dd>{paidPayment.referenceId}</dd>
                  </>
                )}
              </dl>
            </>
          ) : proposedPayment && !editing ? (
            <>
              <p>From the call, it looks like you paid:</p>
              <dl className="flex flex-col gap-space-1">
                <dt className="text-sm text-text-muted">Paid to</dt>
                <dd>{proposedPayment.payee}</dd>
                <dt className="text-sm text-text-muted">Amount</dt>
                <dd>{formatRupees(proposedPayment.amountMinor)}</dd>
              </dl>
              <p>Is that right?</p>
              <ActionBar>
                <Button size="lg" onClick={() => onMatch?.(proposedPayment.fingerprint)}>Yes, that&apos;s right</Button>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  No, let me fix it
                </Button>
              </ActionBar>
            </>
          ) : (
            <p>Tell us what you paid, so the bank and the cyber cell have it. Only the first two are needed.</p>
          )}

          {showForm && (
            <form aria-label="Paid details form" onSubmit={submit} className="flex flex-col gap-space-3">
              <label className="flex flex-col gap-space-1 text-sm font-medium">
                Who did you pay?
                <input className={INPUT_CLASS} value={payee} onChange={(e) => setPayee(e.target.value)} />
              </label>
              <label className="flex flex-col gap-space-1 text-sm font-medium">
                Amount you paid (&#8377;)
                <input className={INPUT_CLASS} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
              <label className="flex flex-col gap-space-1 text-sm font-medium">
                When (optional)
                <input className={INPUT_CLASS} value={transactionTime} onChange={(e) => setTransactionTime(e.target.value)} />
              </label>
              <label className="flex flex-col gap-space-1 text-sm font-medium">
                Payment method (optional)
                <input className={INPUT_CLASS} value={paymentRail} onChange={(e) => setPaymentRail(e.target.value)} />
              </label>
              <label className="flex flex-col gap-space-1 text-sm font-medium">
                Reference ID (optional)
                <input className={INPUT_CLASS} value={referenceId} onChange={(e) => setReferenceId(e.target.value)} />
              </label>
              {error && <p role="alert" className="text-sm font-medium">{error}</p>}
              <ActionBar>
                <Button type="submit">Save</Button>
              </ActionBar>
            </form>
          )}
        </Card>
      </section>

      <section aria-label="Report it">
        <Card title="3. Report it to the cyber helpline">
          <p>
            You can call{' '}
            <a href="tel:1930" className="font-semibold underline">1930</a>
            , or open the official portal. We&apos;ve pre-filled what we know; you check it and submit it yourself.
          </p>
          {callerKnown && <p className="text-sm text-text-muted">Reporting also adds the caller&apos;s number to your private warning list, so you are warned if they call again.</p>}
          {reportHandedOff && (
            <p role="status" className="font-medium">
              Portal opened. We can&apos;t see or confirm your report, so please finish and submit it there.
            </p>
          )}
          <ActionBar>
            <Button size="lg" onClick={() => onOpenReport?.()}>
              Open the cyber-crime portal
            </Button>
            <Button variant="secondary" onClick={() => onDownloadReport?.()}>
              Download the pre-filled form
            </Button>
            <Button variant="secondary" onClick={() => onDownloadEvidence?.()}>
              Save my evidence
            </Button>
          </ActionBar>
          <p className="text-sm text-text-muted">
            Be careful of anyone offering to get your money back for a fee. Genuine banks and the police never ask for payment to recover funds.
          </p>
        </Card>
      </section>
    </main>
  );
}
