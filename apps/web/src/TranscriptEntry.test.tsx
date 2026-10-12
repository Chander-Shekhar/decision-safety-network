import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranscriptEntry } from './TranscriptEntry';

describe('TranscriptEntry', () => {
  it('has no scripted-scenario control and labels itself a prototype capture', () => {
    render(<TranscriptEntry onSubmitPaste={() => {}} onSubmitAudio={() => {}} />);
    expect(screen.queryByText(/play attack scenario/i)).toBeNull();
    expect(screen.getByText(/prototype capture/i)).toBeVisible();
    expect(screen.getByText(/is not stored/i)).toBeVisible();
  });

  it('submits pasted call text and clears the box', async () => {
    const user = userEvent.setup();
    const onSubmitPaste = vi.fn();
    render(<TranscriptEntry onSubmitPaste={onSubmitPaste} onSubmitAudio={() => {}} />);

    const box = screen.getByLabelText(/paste the call/i);
    await user.type(box, 'Caller: hello');
    await user.click(screen.getByRole('button', { name: /add transcript/i }));

    expect(onSubmitPaste).toHaveBeenCalledWith('Caller: hello');
    expect(box).toHaveValue('');
  });

  it('disables Add transcript until there is text', async () => {
    const user = userEvent.setup();
    render(<TranscriptEntry onSubmitPaste={() => {}} onSubmitAudio={() => {}} />);
    const addButton = screen.getByRole('button', { name: /add transcript/i });
    expect(addButton).toBeDisabled();
    await user.type(screen.getByLabelText(/paste the call/i), 'something');
    expect(addButton).toBeEnabled();
  });

  it('uploads a selected audio file to the transcribe handler', async () => {
    const user = userEvent.setup();
    const onSubmitAudio = vi.fn();
    render(<TranscriptEntry onSubmitPaste={() => {}} onSubmitAudio={onSubmitAudio} />);

    const file = new File(['dummy'], 'call.webm', { type: 'audio/webm' });
    await user.upload(screen.getByLabelText(/upload a recording/i), file);
    await user.click(screen.getByRole('button', { name: /transcribe recording/i }));

    expect(onSubmitAudio).toHaveBeenCalledTimes(1);
    expect(onSubmitAudio.mock.calls[0]![0]).toBe(file);
  });

  it('blocks submission while busy', () => {
    render(<TranscriptEntry busy onSubmitPaste={() => {}} onSubmitAudio={() => {}} />);
    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled();
    expect(screen.getByLabelText(/paste the call/i)).toBeDisabled();
  });
});
