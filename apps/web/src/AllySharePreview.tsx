import type { AllyPacketContent } from '../../../packages/contracts/src/ally';

export interface AllySharePreviewProps {
  /** Display name of the accepted ally the owner would share with. */
  allyName: string;
  /** The exact allowlisted content from the owner-only preview API; nothing else is ever shown or sent. */
  packet: AllyPacketContent;
  /** True once the case or selected evidence changed after this preview; Share stays disabled until refreshed. */
  stale?: boolean;
  onShare?: () => void;
  onNotNow?: () => void;
  onRefresh?: () => void;
}

const formatAmount = (amountMinor: number): string => (amountMinor / 100).toLocaleString('en-IN');

/**
 * Owner-side "Share this case?" preview from wireframe frame 03b. Presents
 * exactly the packet an ally would receive and grants nothing by itself:
 * only the explicit Share button calls `onShare`, and Not now leaves ally
 * access denied. Presentational only - the authenticated API owns the
 * preview, the grant, and every data read.
 */
export function AllySharePreview({ allyName, packet, stale = false, onShare, onNotNow, onRefresh }: AllySharePreviewProps): React.JSX.Element {
  return (
    <section aria-label="Ask my ally preview">
      <h2>Share this case with {allyName}?</h2>
      <p>SIMULATED</p>
      <p>{allyName} accepted your invitation, but {allyName} cannot see this case yet.</p>

      <h3>Exact packet {allyName} will see</h3>
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
      <p>Full transcript and other evidence are not included.</p>

      {stale && (
        <div role="alert">
          <p>This preview is out of date because the case changed. Refresh it to see the current packet.</p>
          <button type="button" onClick={() => onRefresh?.()}>
            Refresh preview
          </button>
        </div>
      )}

      <button type="button" disabled={stale} onClick={() => onShare?.()}>
        Share this case with {allyName}
      </button>
      <button type="button" onClick={() => onNotNow?.()}>
        Not now
      </button>
      <p>A case-specific grant is created only after you share.</p>
      <p>Revoke this grant at any time; {allyName} loses access on the next request.</p>
    </section>
  );
}
