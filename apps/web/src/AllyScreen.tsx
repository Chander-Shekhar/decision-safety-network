import { useState } from 'react';
import type { AllyCallerContact, AllyPacket } from '../../../packages/contracts/src/ally';
import { ActionBar, Button, Callout, Card, Field } from './ui';

export interface AllyScreenProps {
  /** The frozen packet from `GET /api/v1/ally/cases/:id`; the only case data this screen ever receives. */
  packet: AllyPacket;
  /** `stale`/`revoked` replace the packet entirely; the API has already denied the read. */
  accessState?: 'active' | 'stale' | 'revoked';
  onContactRequest?: () => void;
  onPauseRecommendation?: () => void;
  onCheckedSource?: (source: string) => void;
  /** DSN-027: ally taps to prepare contacting the caller on the owner's behalf (advisory; no funds, no certification). */
  onContactCaller?: () => void;
  /** DSN-027: the script returned by `POST /api/v1/ally/cases/:id/contact-caller`. */
  callerContact?: AllyCallerContact;
}

const formatAmount = (amountMinor: number): string => (amountMinor / 100).toLocaleString('en-IN');

/**
 * The Safety Ally's separate-session view from wireframe frame 04. Shows
 * ONLY the minimum packet and offers exactly three advisory responses.
 * There is deliberately no prop, control, or label for a payment command,
 * transfer control, or caller certification. Presentational only.
 */
export function AllyScreen({ packet, accessState = 'active', onContactRequest, onPauseRecommendation, onCheckedSource, onContactCaller, callerContact }: AllyScreenProps): React.JSX.Element {
  const [source, setSource] = useState('');

  if (accessState === 'stale') {
    return (
      <section aria-label="Safety Ally review">
        <Card title="Safety Ally review">
          <Callout kind="caution" role="status">
            This case changed after it was shared, so it is hidden. Ask the owner to preview and share it again.
          </Callout>
        </Card>
      </section>
    );
  }
  if (accessState === 'revoked') {
    return (
      <section aria-label="Safety Ally review">
        <Card title="Safety Ally review">
          <Callout kind="info" role="status">
            You no longer have access to this case.
          </Callout>
        </Card>
      </section>
    );
  }

  const submitSource = (): void => {
    const trimmed = source.trim();
    if (trimmed === '') {
      return;
    }
    onCheckedSource?.(trimmed);
    setSource('');
  };

  return (
    <section aria-label="Safety Ally review">
      <Card title="Safety Ally review">
        <p>Your review is requested. This case has been shared with you.</p>

        <h3 className="text-base font-semibold">Minimum case packet</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-space-4 gap-y-space-1">
          <dt className="text-sm text-text-muted">Caller claimed</dt>
          <dd>{packet.claim}</dd>
          <dt className="text-sm text-text-muted">Proposed action</dt>
          <dd>{packet.proposedAction}</dd>
          <dt className="text-sm text-text-muted">Amount</dt>
          <dd>{packet.amountMinor === null ? 'No amount proposed' : `₹ ${formatAmount(packet.amountMinor)}`}</dd>
          <dt className="text-sm text-text-muted">Verification gap</dt>
          <dd>{packet.verificationGap}</dd>
        </dl>
        <h4 className="text-sm font-semibold">Short summary</h4>
        <p className="rounded-md border-l-4 border-border bg-surface-sunken p-space-3 text-sm">{packet.summary}</p>
        <p className="text-sm text-text-muted">A short AI summary of the call. No recording or full transcript is shared — reach out to them for more.</p>

        <h3 className="text-base font-semibold">Your response</h3>
        <ActionBar>
          <Button onClick={() => onContactRequest?.()}>Request contact</Button>
          <Button variant="pause" onClick={() => onPauseRecommendation?.()}>
            Recommend pause
          </Button>
          {onContactCaller && (
            <Button variant="secondary" onClick={() => onContactCaller()}>
              Contact the caller for the owner
            </Button>
          )}
        </ActionBar>
        {callerContact && (
          <section aria-label="Caller contact script" className="flex flex-col gap-space-2">
            <h4 className="text-sm font-semibold">What to say to the caller</h4>
            <pre className="whitespace-pre-wrap rounded-md bg-surface-sunken p-space-3 font-sans text-sm">{callerContact.script}</pre>
            <p className="text-sm text-text-muted">Nothing is dialed or sent for you. This does not approve payments or confirm who the caller is.</p>
          </section>
        )}
        <Field label="Independent source you checked" htmlFor="ally-checked-source">
          <input
            id="ally-checked-source"
            type="text"
            value={source}
            maxLength={500}
            onChange={(event) => setSource(event.target.value)}
            className="rounded-md border border-border bg-surface-raised px-space-3 py-space-2 text-text"
          />
        </Field>
        <ActionBar>
          <Button variant="secondary" onClick={submitSource}>
            Record source
          </Button>
        </ActionBar>
        <p className="text-sm text-text-muted">You cannot control funds or certify the caller.</p>
        <p className="text-sm text-text-muted">The owner can revoke this case grant at any time.</p>
      </Card>
    </section>
  );
}
