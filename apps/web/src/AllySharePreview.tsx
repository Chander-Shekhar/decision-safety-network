import type { AllyPacketContent, AllyWhatsAppSummary } from '../../../packages/contracts/src/ally';
import { ActionBar, Button, Callout, Card } from './ui';

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
  /** DSN-027: owner asks the API for the WhatsApp summary (only meaningful after Share). */
  onPrepareWhatsApp?: () => void;
  /** DSN-027: the API-built summary (minimum packet only); the link is opened by the human. */
  whatsappSummary?: AllyWhatsAppSummary;
}

const formatAmount = (amountMinor: number): string => (amountMinor / 100).toLocaleString('en-IN');

/**
 * Owner-side "Share this case?" preview from wireframe frame 03b. Presents
 * exactly the packet an ally would receive and grants nothing by itself:
 * only the explicit Share button calls `onShare`, and Not now leaves ally
 * access denied. Presentational only - the authenticated API owns the
 * preview, the grant, and every data read.
 */
export function AllySharePreview({ allyName, packet, stale = false, onShare, onNotNow, onRefresh, onPrepareWhatsApp, whatsappSummary }: AllySharePreviewProps): React.JSX.Element {
  return (
    <section aria-label="Ask my ally preview">
      <Card title={<>Share this case with {allyName}?</>}>
        <p>{allyName} accepted your invitation, but {allyName} cannot see this case yet.</p>

        <h3 className="text-base font-semibold">Exact packet {allyName} will see</h3>
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
        <p className="text-sm text-text-muted">
          A short AI summary of the call — not the recording or transcript. {allyName} can reach you for more.
        </p>

        {stale && (
          <Callout kind="caution" role="alert">
            <p>This preview is out of date because the case changed. Refresh it to see the current packet.</p>
            <ActionBar>
              <Button variant="secondary" onClick={() => onRefresh?.()}>
                Refresh preview
              </Button>
            </ActionBar>
          </Callout>
        )}

        <ActionBar>
          <Button disabled={stale} onClick={() => onShare?.()}>
            Share this case with {allyName}
          </Button>
          <Button variant="secondary" onClick={() => onNotNow?.()}>
            Not now
          </Button>
        </ActionBar>
        {(whatsappSummary || onPrepareWhatsApp) && (
          <section aria-label="WhatsApp summary" className="flex flex-col gap-space-2">
            <h3 className="text-base font-semibold">Reach {allyName} on WhatsApp</h3>
            {whatsappSummary ? (
              <>
                <p className="text-sm text-text-muted">Only the packet above, as text. Nothing is sent until you tap and send it in WhatsApp.</p>
                <pre className="whitespace-pre-wrap rounded-md bg-surface-sunken p-space-3 font-sans text-sm">{whatsappSummary.text}</pre>
                <ActionBar>
                  <a
                    href={whatsappSummary.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-border bg-surface-raised px-space-4 py-space-2 font-medium underline"
                  >
                    Open WhatsApp to send summary
                  </a>
                </ActionBar>
              </>
            ) : (
              <ActionBar>
                <Button variant="secondary" onClick={() => onPrepareWhatsApp?.()}>
                  Prepare WhatsApp summary
                </Button>
              </ActionBar>
            )}
          </section>
        )}
        <p className="text-sm text-text-muted">A case-specific grant is created only after you share.</p>
        <p className="text-sm text-text-muted">Revoke this grant at any time; {allyName} loses access on the next request.</p>
      </Card>
    </section>
  );
}
