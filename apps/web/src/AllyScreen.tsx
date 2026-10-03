import { useState } from 'react';
import type { AllyPacket } from '../../../packages/contracts/src/ally';

export interface AllyScreenProps {
  /** The frozen packet from `GET /api/v1/ally/cases/:id`; the only case data this screen ever receives. */
  packet: AllyPacket;
  /** `stale`/`revoked` replace the packet entirely; the API has already denied the read. */
  accessState?: 'active' | 'stale' | 'revoked';
  onContactRequest?: () => void;
  onPauseRecommendation?: () => void;
  onCheckedSource?: (source: string) => void;
}

const formatAmount = (amountMinor: number): string => (amountMinor / 100).toLocaleString('en-IN');

/**
 * The Safety Ally's separate-session view from wireframe frame 04. Shows
 * ONLY the minimum packet and offers exactly three advisory responses.
 * There is deliberately no prop, control, or label for a payment command,
 * transfer control, or caller certification. Presentational only.
 */
export function AllyScreen({ packet, accessState = 'active', onContactRequest, onPauseRecommendation, onCheckedSource }: AllyScreenProps): React.JSX.Element {
  const [source, setSource] = useState('');

  if (accessState === 'stale') {
    return (
      <section aria-label="Safety Ally review">
        <h2>Safety Ally review</h2>
        <p role="status">This case changed after it was shared, so it is hidden. Ask the owner to preview and share it again.</p>
      </section>
    );
  }
  if (accessState === 'revoked') {
    return (
      <section aria-label="Safety Ally review">
        <h2>Safety Ally review</h2>
        <p role="status">You no longer have access to this case.</p>
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
      <h2>Safety Ally review</h2>
      <p>SIMULATED</p>
      <p>Your review is requested. Separate sign-in &middot; this case&apos;s grant only.</p>

      <h3>Minimum case packet</h3>
      <dl>
        <dt>Caller claimed</dt>
        <dd>{packet.claim}</dd>
        <dt>Proposed action</dt>
        <dd>{packet.proposedAction}</dd>
        <dt>Amount</dt>
        <dd>{packet.amountMinor === null ? 'No amount proposed' : `₹ ${formatAmount(packet.amountMinor)}`}</dd>
        <dt>Verification gap</dt>
        <dd>{packet.verificationGap}</dd>
      </dl>
      <h4>Selected evidence</h4>
      <ul>
        {packet.selectedEvidence.map((item) => (
          <li key={item.id}>
            <blockquote>{item.excerpt}</blockquote>
          </li>
        ))}
      </ul>
      <p>No full transcript or unselected evidence is shared.</p>

      <h3>Your response</h3>
      <button type="button" onClick={() => onContactRequest?.()}>
        Request contact
      </button>
      <button type="button" onClick={() => onPauseRecommendation?.()}>
        Recommend pause
      </button>
      <div>
        <label htmlFor="ally-checked-source">Independent source you checked</label>
        <input id="ally-checked-source" type="text" value={source} maxLength={500} onChange={(event) => setSource(event.target.value)} />
        <button type="button" onClick={submitSource}>
          Record source
        </button>
      </div>
      <p>You cannot control funds or certify the caller.</p>
      <p>The owner can revoke this case grant at any time.</p>
    </section>
  );
}
