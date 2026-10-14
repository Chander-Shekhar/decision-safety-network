import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionInput } from './SessionInput';

describe('SessionInput', () => {
  it('offers three ways to add a call: live, paste, upload', () => {
    render(<SessionInput onSubmitPaste={() => {}} onSubmitAudio={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Live call' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Paste transcript' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Upload recording' })).toBeVisible();
  });

  it('submits pasted call text and clears the box', async () => {
    const user = userEvent.setup();
    const onSubmitPaste = vi.fn();
    render(<SessionInput onSubmitPaste={onSubmitPaste} onSubmitAudio={() => {}} />);

    const box = screen.getByLabelText(/paste the call/i);
    await user.type(box, 'Caller: hello');
    await user.click(screen.getByRole('button', { name: /add transcript/i }));

    expect(onSubmitPaste).toHaveBeenCalledWith('Caller: hello');
    expect(box).toHaveValue('');
  });

  it('uploads a selected recording to the transcribe handler', async () => {
    const user = userEvent.setup();
    const onSubmitAudio = vi.fn();
    render(<SessionInput onSubmitPaste={() => {}} onSubmitAudio={onSubmitAudio} />);

    await user.click(screen.getByRole('tab', { name: 'Upload recording' }));
    const file = new File(['dummy'], 'call.webm', { type: 'audio/webm' });
    await user.upload(screen.getByLabelText(/upload a recording/i), file);
    await user.click(screen.getByRole('button', { name: /transcribe recording/i }));

    expect(onSubmitAudio).toHaveBeenCalledTimes(1);
    expect(onSubmitAudio.mock.calls[0]![0]).toBe(file);
  });

  it('traverses tabs with the arrow keys (completed tablist pattern)', async () => {
    const user = userEvent.setup();
    render(<SessionInput onSubmitPaste={() => {}} onSubmitAudio={() => {}} />);

    const paste = screen.getByRole('tab', { name: 'Paste transcript' });
    expect(paste).toHaveAttribute('aria-selected', 'true');
    paste.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Upload recording' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}'); // wraps to the first tab
    expect(screen.getByRole('tab', { name: 'Live call' })).toHaveAttribute('aria-selected', 'true');
  });

  it('reflects live capture state in the live tab', async () => {
    const user = userEvent.setup();
    render(<SessionInput captureActive onSubmitPaste={() => {}} onSubmitAudio={() => {}} />);
    await user.click(screen.getByRole('tab', { name: 'Live call' }));
    expect(screen.getByText(/listening to the call now/i)).toBeVisible();
  });

  it('blocks submission and disables the paste box while busy', () => {
    render(<SessionInput busy onSubmitPaste={() => {}} onSubmitAudio={() => {}} />);
    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled();
    expect(screen.getByLabelText(/paste the call/i)).toBeDisabled();
  });
});
