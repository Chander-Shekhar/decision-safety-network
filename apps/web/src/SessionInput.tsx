import { useRef, useState } from 'react';
import { Button, Card, Field, IllustrativeTag } from './ui';

export type SessionInputMode = 'live' | 'paste' | 'upload';

export interface SessionInputProps {
  /** A submit is in flight (appending segments + extraction, or transcribing). */
  busy?: boolean;
  /** No open case yet, or capture otherwise unavailable. */
  disabled?: boolean;
  /** Native shell is capturing the live call right now (DSN-025 bridge). */
  captureActive?: boolean;
  /** Pasted call text: one turn per non-empty line, with an optional "Name:" speaker prefix. The
   *  caller's number (empty if the operator left it blank) rides along so it can be verified later. */
  onSubmitPaste: (text: string, callerNumber: string) => void;
  /** An uploaded audio recording of the call, to be transcribed server-side; plus the caller's number. */
  onSubmitAudio: (file: File, callerNumber: string) => void;
}

const MODES: { value: SessionInputMode; label: string }[] = [
  { value: 'live', label: 'Live call' },
  { value: 'paste', label: 'Paste transcript' },
  { value: 'upload', label: 'Upload recording' },
];

/**
 * The one place to bring a call into a session, with a switcher across the
 * three ways it can arrive: a live call captured on the device (DSN-025), a
 * pasted transcript, or an uploaded recording (DSN-030). All three feed the
 * same segments + fact-extraction pipeline. Live capture only runs inside the
 * device shell, so on the web it is shown as illustrative and the operator
 * uses paste or upload. This component only collects input and calls back.
 */
export function SessionInput({
  busy = false,
  disabled = false,
  captureActive = false,
  onSubmitPaste,
  onSubmitAudio,
}: SessionInputProps): React.JSX.Element {
  const [mode, setMode] = useState<SessionInputMode>('paste');
  const [pasted, setPasted] = useState('');
  const [callerNumber, setCallerNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);

  const blocked = busy || disabled;

  /** Standard tablist keyboard traversal: arrows wrap, Home/End jump to ends. */
  function onTabKeyDown(index: number, e: React.KeyboardEvent): void {
    const last = MODES.length - 1;
    let next = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = index === last ? 0 : index + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = index === 0 ? last : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    setMode(MODES[next]!.value);
    tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  function submitPaste(): void {
    const text = pasted.trim();
    if (!text || blocked) return;
    onSubmitPaste(text, callerNumber.trim());
    setPasted('');
  }
  function submitAudio(): void {
    if (!file || blocked) return;
    onSubmitAudio(file, callerNumber.trim());
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <Card title="Add the call">
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="How to add the call"
        className="flex gap-space-1 rounded-md bg-surface-sunken p-space-1"
      >
        {MODES.map((m, i) => (
          <button
            key={m.value}
            id={`session-input-tab-${m.value}`}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            aria-controls={`session-input-panel-${m.value}`}
            tabIndex={mode === m.value ? 0 : -1}
            onClick={() => setMode(m.value)}
            onKeyDown={(e) => onTabKeyDown(i, e)}
            className={`flex-1 rounded-md px-space-3 py-space-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              mode === m.value ? 'bg-surface font-semibold shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* The caller's number comes first — captured here alongside the transcript/recording so the
          "What we heard" panel can verify it against public listings automatically. The live/device
          path already has the screened number, so this is shown only for paste and upload. Optional. */}
      {mode !== 'live' && (
        <Field
          label="Caller's number"
          htmlFor="caller-number"
          hint="Optional. We’ll check it against public listings for the organisation they claimed to be from."
        >
          <input
            id="caller-number"
            inputMode="tel"
            placeholder="+91…"
            value={callerNumber}
            disabled={blocked}
            onChange={(e) => setCallerNumber(e.target.value)}
            className="rounded-md border border-border bg-surface p-space-3 text-text"
          />
        </Field>
      )}

      {mode === 'live' && (
        <div
          id="session-input-panel-live"
          role="tabpanel"
          aria-labelledby="session-input-tab-live"
          className="flex flex-col gap-space-2"
        >
          <p className="font-semibold">
            Live call <IllustrativeTag />
          </p>
          <p className="text-text-muted">
            {captureActive
              ? 'Listening to the call now. Spoken turns appear in the session as they are recognised.'
              : 'On your phone, the call is captured live and read for scam patterns as it happens. In this web preview, use Paste transcript or Upload recording to bring a call in.'}
          </p>
        </div>
      )}

      {mode === 'paste' && (
        <div id="session-input-panel-paste" role="tabpanel" aria-labelledby="session-input-tab-paste">
          <Field
            label="Paste the call"
            htmlFor="transcript-paste"
            hint="One line per turn. Prefix with a name like “Caller:” if you want."
          >
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
              {busy ? 'Working…' : 'Add transcript'}
            </Button>
          </div>
        </div>
      )}

      {mode === 'upload' && (
        <div id="session-input-panel-upload" role="tabpanel" aria-labelledby="session-input-tab-upload">
          <Field label="Upload a recording" htmlFor="transcript-audio" hint="An audio recording of the call. It is transcribed and not stored.">
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
        </div>
      )}
    </Card>
  );
}
