import { Card } from './ui';
import type { DeviceSignal } from './deviceSignals';

/** Renders consented on-device signals (DSN-020) as received-message CLAIMS.
 * Never presents a message as paid or verified. Inert when `signals` is empty. */
export function DeviceSignalList({ signals }: { signals: DeviceSignal[] }): React.JSX.Element | null {
  if (signals.length === 0) return null;
  return (
    <section aria-label="On-device signals">
      <Card title="On-device signals">
        <ul className="flex flex-col gap-space-3">
          {signals.map((s) => (
            <li key={s.id} className="flex flex-col gap-space-1 border-t border-border pt-space-3 first:border-0 first:pt-0">
              <div className="flex items-center gap-space-2">
                <strong>Incoming SMS</strong>
                <span className="text-xs text-text-muted">Message received on device</span>

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
