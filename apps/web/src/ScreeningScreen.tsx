import { useId, useState } from 'react';
import type { ScreeningVerdict } from '../../../packages/contracts/src/screening';
import { Badge, Button, Callout, Card, Field } from './ui';

/** Synthetic demo numbers the simulated caller-ID provider recognises. */
export const DEMO_NUMBERS = [
  { label: 'Unfamiliar number', number: '+91 99999 00002' },
  { label: 'Flagged by others', number: '+91 99999 00001' },
  { label: 'Ordinary number', number: '+91 98765 43210' },
] as const;

export interface IncomingCallScreenProps {
  /** Screens the number server-side. Rejects on failure; the screen then offers a retry and changes nothing. */
  onScreen: (number: string) => Promise<ScreeningVerdict>;
  onAnswer: (number: string, verdict: ScreeningVerdict) => void;
  onDecline: () => void;
}

/**
 * Pre-pickup screen (PRD C2). A warning appears only when the server's
 * verdict says so; a clean number shows the call and nothing else. The
 * verdict is advisory: it offers "answer with protection" or "let it ring"
 * and never labels a caller as safe or official.
 */
export function IncomingCallScreen({ onScreen, onAnswer, onDecline }: IncomingCallScreenProps): React.JSX.Element {
  const inputId = useId();
  const [number, setNumber] = useState('');
  const [verdict, setVerdict] = useState<ScreeningVerdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function screen(value: string) {
    setBusy(true);
    setFailed(false);
    try {
      setVerdict(await onScreen(value));
    } catch {
      setVerdict(null);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Incoming call">
      <Card title="Incoming call">
        {!verdict && (
          <>
            <Field label="Caller's number" htmlFor={inputId} hint="Pick a sample number or type one. The number is checked before you pick up.">
              <input
                id={inputId}
                inputMode="tel"
                className="rounded-md border border-border bg-surface-raised px-space-3 py-space-2"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-space-2">
              {DEMO_NUMBERS.map((demo) => (
                <Button
                  key={demo.number}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setNumber(demo.number);
                    void screen(demo.number);
                  }}
                >
                  {demo.label}
                </Button>
              ))}
            </div>
            <div>
              <Button disabled={busy || number.trim() === ''} onClick={() => void screen(number)}>
                Check this call
              </Button>
            </div>
            {failed && (
              <Callout kind="info" role="status">
                We couldn&apos;t check that number. Nothing was changed &mdash; check the digits and try again.
              </Callout>
            )}
          </>
        )}

        {verdict && (
          <>
            <p className="text-lg font-semibold">{verdict.maskedNumber}</p>
            {verdict.warn && (
              <Callout kind="caution" role="alert">
                <p className="font-semibold">{verdict.headline}</p>
                <p>{verdict.detail}</p>
                <p className="mt-space-2">
                  <Badge tone="simulated">Simulated caller-ID lookup</Badge>
                </p>
              </Callout>
            )}
            {verdict.listening === 'listen' ? (
              <p className="text-sm text-text-muted">Listening is on for this call, per your Safety Plan.</p>
            ) : (
              <p className="text-sm text-text-muted">You&apos;ll choose whether to listen once you pick up.</p>
            )}
            <div className="flex flex-wrap items-center gap-space-3">
              <Button size="lg" onClick={() => onAnswer(number, verdict)}>
                {verdict.warn ? 'Answer with protection' : 'Answer'}
              </Button>
              <Button variant="ghost" onClick={onDecline}>
                {verdict.warn ? 'Let it ring' : 'Decline'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

export interface ConfirmFraudPanelProps {
  initialNumber?: string;
  /** Adds the number to the owner's fraud-number list. Resolves to the masked number on success. */
  onConfirm: (callerNumber: string) => Promise<string>;
}

/** Explicit, owner-initiated confirmation: the only way (besides a recorded authority report) the fraud-number list grows. */
export function ConfirmFraudPanel({ initialNumber = '', onConfirm }: ConfirmFraudPanelProps): React.JSX.Element {
  const inputId = useId();
  const [number, setNumber] = useState(initialNumber);
  const [added, setAdded] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  return (
    <section aria-label="Confirm caller as fraud">
      <Card title="Was this call a scam?">
        <p className="text-sm text-text-muted">
          If you&apos;re sure, let&apos;s add the caller to the scammer list.
        </p>
        {added ? (
          <Callout kind="info" role="status">
            {added} is now on your fraud-number list.
          </Callout>
        ) : (
          <>
            <Field label="Caller's number" htmlFor={inputId}>
              <input
                id={inputId}
                inputMode="tel"
                className="rounded-md border border-border bg-surface-raised px-space-3 py-space-2"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </Field>
            <div>
              <Button
                variant="secondary"
                disabled={number.trim() === ''}
                onClick={() => {
                  setFailed(false);
                  onConfirm(number).then(setAdded, () => setFailed(true));
                }}
              >
                Yes, confirm as fraud
              </Button>
            </div>
            {failed && (
              <Callout kind="info" role="status">
                We couldn&apos;t add that number. Nothing was changed.
              </Callout>
            )}
          </>
        )}
      </Card>
    </section>
  );
}
