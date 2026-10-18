import type { AllyPacket, AllySharer } from '../../../packages/contracts/src/ally';
import { toWhatsAppNumber } from '../../../packages/contracts/src/profile';
import { Callout, Card } from './ui';

export interface AllyScreenProps {
  /** The frozen packet from `GET /api/v1/ally/cases/:id`; the only case data this screen ever receives. */
  packet: AllyPacket;
  /** `stale`/`revoked` replace the packet entirely; the API has already denied the read. */
  accessState?: 'active' | 'stale' | 'revoked';
  /** Who shared the case (the owner's self-entered name + mobile), so the ally knows whom to reach. */
  sharer?: AllySharer;
}

const formatAmount = (amountMinor: number): string => (amountMinor / 100).toLocaleString('en-IN');

/**
 * The Safety Ally's separate-session view from wireframe frame 04. Shows
 * ONLY the minimum packet, who shared it, and one way to act: call them.
 * There is deliberately no prop, control, or label for a payment command,
 * transfer control, or caller certification. Presentational only.
 */
export function AllyScreen({ packet, accessState = 'active', sharer }: AllyScreenProps): React.JSX.Element {
  const dialable = toWhatsAppNumber(sharer?.mobile);
  const sharerName = sharer?.displayName || 'the person who shared this';

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

  return (
    <section aria-label="Safety Ally review">
      <Card title="Safety Ally review">
        <p>
          {sharer?.displayName ? <><strong>{sharer.displayName}</strong> has shared this case with you.</> : 'This case has been shared with you.'}
        </p>

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

        <h3 className="text-base font-semibold">Reach {sharerName}</h3>
        {dialable ? (
          <a
            href={`tel:+${dialable}`}
            className="inline-flex w-full items-center justify-center gap-space-2 rounded-md border border-transparent bg-primary px-space-5 py-space-3 text-base font-semibold text-primary-contrast shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
          >
            {sharer?.displayName ? `Call ${sharer.displayName}` : 'Call them'}
          </a>
        ) : (
          <p className="text-sm text-text-muted">They haven&apos;t added a phone number yet. Reach out to them directly.</p>
        )}
      </Card>
    </section>
  );
}
