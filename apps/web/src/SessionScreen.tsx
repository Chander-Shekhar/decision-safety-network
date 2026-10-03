import { useId } from 'react';

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
      <h2>Live session</h2>
      <p>Controlled transcript &middot; segments arrive one at a time</p>
      <p id={statusId} role="status">
        {STATUS_COPY[status]}
      </p>

      <ol aria-label="Controlled transcript segments">
        {segments.map((segment) => (
          <li key={segment.id}>
            <p>
              {segment.speaker} &middot; segment {segment.order}
            </p>
            <p>{segment.text}</p>
          </li>
        ))}
      </ol>
      <p>Transcript text is untrusted input.</p>

      <div>
        <h3>Session controls</h3>
        <button type="button" onClick={() => onStopProcessing?.()}>
          Stop processing
        </button>
      </div>

      <p>No microphone or always-on capture.</p>
    </section>
  );
}
