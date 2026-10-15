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
  /** DSN-025: true only while the native companion reports it is capturing via the microphone. */
  captureActive?: boolean;
  /** True only when native confirms the on-device recognizer is in use; gates the no-upload claim. */
  captureOnDevice?: boolean;
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
export function SessionScreen({ status, segments, onStopProcessing, captureActive = false, captureOnDevice = false }: SessionScreenProps): React.JSX.Element {
  const statusId = useId();

  return (
    <section aria-label="Live session">
      <Card title="Live session">
        {captureActive ? (
          <p role="note" className="text-sm font-medium">
            Capturing this call&apos;s audio via the microphone on speakerphone, with your consent.
            {captureOnDevice
              ? ' Speech is transcribed by the on-device recognizer; the audio is not uploaded.'
              : " Transcribed by the device's speech recognizer (offline preferred, but the engine may use an online service); only text is sent to DSN."}
          </p>
        ) : (
          <p className="text-sm text-text-muted">Controlled transcript &middot; segments arrive one at a time</p>
        )}
        <p id={statusId} role="status" className="text-sm font-medium">
          <Badge tone={status === 'processing' ? 'info' : 'neutral'}>{STATUS_COPY[status]}</Badge>
        </p>

        <ol aria-label={captureActive ? 'Live transcript segments' : 'Controlled transcript segments'} className="flex flex-col gap-space-3">
          {segments.map((segment) => (
            <li key={segment.id} className="rounded-md border border-border bg-surface-sunken p-space-3">
              <p className="text-xs font-medium text-text-muted">
                {segment.speaker} &middot; segment {segment.order}
              </p>
              <p>{segment.text}</p>
            </li>
          ))}
        </ol>

        {/* "Stop processing" ends live microphone capture, so it only makes sense while
            native is actually capturing. On the web (no live capture) there is nothing to
            stop, so the control is not shown. */}
        {captureActive && (
          <div className="flex flex-col gap-space-2">
            <h3 className="text-sm font-semibold">Session controls</h3>
            <Button variant="secondary" onClick={() => onStopProcessing?.()}>
              Stop processing
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}
