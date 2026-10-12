import { useRef, useState } from 'react';
import { Button, Callout, Card, Field } from './ui';

export interface TranscriptEntryProps {
  /** A submit is in flight (appending segments + extraction, or transcribing). */
  busy?: boolean;
  /** No open case yet, or capture otherwise unavailable. */
  disabled?: boolean;
  /** Pasted call text: one turn per non-empty line, with an optional "Name:" speaker prefix. */
  onSubmitPaste: (text: string) => void;
  /** An uploaded audio recording of the call, to be transcribed server-side. */
  onSubmitAudio: (file: File) => void;
}

/**
 * The owner's real call-input surface (DSN-030), replacing the hardcoded
 * "Play attack scenario" button. The user either pastes the call text or
 * uploads a recording; both flow into the same segments + `facts/extract`
 * pipeline as the live-capture bridge. This component only collects the
 * input and calls back - App owns the pipeline. Persistently labeled as a
 * prototype capture; an uploaded recording is transcribed and never stored.
 */
export function TranscriptEntry({ busy = false, disabled = false, onSubmitPaste, onSubmitAudio }: TranscriptEntryProps) {
  const [pasted, setPasted] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const blocked = busy || disabled;

  function submitPaste(): void {
    const text = pasted.trim();
    if (!text || blocked) return;
    onSubmitPaste(text);
    setPasted('');
  }

  function submitAudio(): void {
    if (!file || blocked) return;
    onSubmitAudio(file);
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <Card title="Add the call">
      <Callout kind="info">
        Prototype capture. Paste the call or upload a recording and we extract the facts for you to review. An uploaded
        recording is transcribed and is not stored.
      </Callout>

      <Field label="Paste the call" htmlFor="transcript-paste" hint="One line per turn. Prefix with a name like “Caller:” if you want.">
        <textarea
          id="transcript-paste"
          className="min-h-[6rem] rounded-md border border-border bg-surface p-space-3 text-text"
          value={pasted}
          disabled={blocked}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={'Caller: This is the bank fraud team…\nYou: …'}
        />
      </Field>
      <div>
        <Button variant="secondary" onClick={submitPaste} disabled={blocked || pasted.trim().length === 0}>
          Add transcript
        </Button>
      </div>

      <Field label="Or upload a recording" htmlFor="transcript-audio" hint="An audio recording of the call (not retained).">
        <input
          id="transcript-audio"
          ref={fileRef}
          type="file"
          accept="audio/*"
          disabled={blocked}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      <div>
        <Button variant="secondary" onClick={submitAudio} disabled={blocked || !file}>
          {busy ? 'Working…' : 'Transcribe recording'}
        </Button>
      </div>
    </Card>
  );
}
