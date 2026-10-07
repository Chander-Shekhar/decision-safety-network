import { useId } from 'react';
import { Badge, Button, Card } from './ui';

/**
 * Live-processing status for the controlled session. `processing` is the
 * normal state while segments are being accepted; `degraded` means intake
 * or inference is impaired but manual controls still work; `unavailable`
 * means live processing cannot currently run at all. See frame 02
 * (docs/design/wireframes/02-live-case.svg) and its "Failure remains
 * actionable" rule - this screen must never silently imply a false
 * `processing` state when it is not.
 */
export type SessionStatus = 'processing' | 'degraded' | 'unavailable';

/** A minimal, already-trusted view of one accepted segment, for display only. */
export interface SessionSegmentView {
  id: string;
  order: number;
  speaker: string;
  text: string;
}

export interface SessionScreenProps {
  status: SessionStatus;
  segments: SessionSegmentView[];
  onStopProcessing?: () => void;
}

const STATUS_COPY: Record<SessionStatus, string> = {
  processing: 'Controlled input · Processing live',
  degraded: 'Controlled input · Live processing degraded',
  unavailable: 'Controlled input · Live processing unavailable',
};

/**
 * The "Live session" panel from wireframe frame 02: a controlled,
 * incrementally streamed transcript, never a microphone/always-on capture.
 * Decision Map (Task 4) and the payment surface (Task 6) are separate
 * screens composed alongside this one later - this component's scope is
 * only the controlled transcript intake and its live-processing status.
 */
export function SessionScreen({ status, segments, onStopProcessing }: SessionScreenProps): React.JSX.Element {
  const statusId = useId();

  return (
    <section aria-label="Live session">
      <Card title="Live session">
        <p className="text-sm text-text-muted">Controlled transcript &middot; segments arrive one at a time</p>
        <p id={statusId} role="status" className="text-sm font-medium">
          <Badge tone={status === 'processing' ? 'info' : 'neutral'}>{STATUS_COPY[status]}</Badge>
        </p>

        <ol aria-label="Controlled transcript segments" className="flex flex-col gap-space-3">
          {segments.map((segment) => (
            <li key={segment.id} className="rounded-md border border-border bg-surface-sunken p-space-3">
              <p className="text-xs font-medium text-text-muted">
                {segment.speaker} &middot; segment {segment.order}
              </p>
              <p>{segment.text}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-text-muted">Transcript text is untrusted input.</p>

        <div className="flex flex-col gap-space-2">
          <h3 className="text-sm font-semibold">Session controls</h3>
          <Button variant="secondary" onClick={() => onStopProcessing?.()}>
            Stop processing
          </Button>
        </div>

        <p className="text-sm text-text-muted">No microphone or always-on capture.</p>
      </Card>
    </section>
  );
}
