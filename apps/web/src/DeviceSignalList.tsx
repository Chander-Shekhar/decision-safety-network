import { Badge, Callout, Card } from './ui';
import type { DeviceSignal } from './deviceSignals';

/** Renders consented on-device signals (DSN-020) as received-message CLAIMS.
 * Never presents a message as paid or verified. Inert when `signals` is empty. */
export function DeviceSignalList({ signals }: { signals: DeviceSignal[] }): React.JSX.Element | null {
  if (signals.length === 0) return null;
  return (
    <section aria-label="On-device signals">
      <Card title="On-device signals">
        <Callout kind="info">
          A received message is a claim, not a verified fact or a completed payment.
        </Callout>
        <ul className="flex flex-col gap-space-3">
          {signals.map((s) => (
            <li key={s.id} className="flex flex-col gap-space-1 rounded-md border border-border p-space-3">
              <div className="flex items-center gap-space-2">
                <strong>Incoming SMS</strong>
                <Badge tone="info">Message received on device</Badge>
              </div>
              <p className="text-sm text-text-muted">From {s.from} · {s.receivedAt}</p>
              <p>{s.body}</p>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
