import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionScreen } from './SessionScreen';

describe('SessionScreen', () => {
  it('visibly labels the input as a controlled transcript', () => {
    render(<SessionScreen status="processing" segments={[]} />);
    expect(screen.getByText(/controlled transcript/i)).toBeVisible();
  });

  it('shows the processing status distinctly from degraded and unavailable', () => {
    const { rerender } = render(<SessionScreen status="processing" segments={[]} />);
    expect(screen.getByText(/processing live/i)).toBeVisible();
    expect(screen.queryByText(/degraded/i)).toBeNull();
    expect(screen.queryByText(/unavailable/i)).toBeNull();

    rerender(<SessionScreen status="degraded" segments={[]} />);
    expect(screen.getByText(/degraded/i)).toBeVisible();
    expect(screen.queryByText(/processing live/i)).toBeNull();

    rerender(<SessionScreen status="unavailable" segments={[]} />);
    expect(screen.getByText(/unavailable/i)).toBeVisible();
    expect(screen.queryByText(/processing live/i)).toBeNull();
    expect(screen.queryByText(/degraded/i)).toBeNull();
  });

  it('shows the live-capture + consent label only while capture is active (DSN-025)', () => {
    const { rerender } = render(<SessionScreen status="processing" segments={[]} />);
    expect(screen.queryByText(/microphone on speakerphone/i)).toBeNull();
    rerender(<SessionScreen status="processing" segments={[]} captureActive />);
    expect(screen.getByText(/capturing this call.*microphone on speakerphone, with your consent/i)).toBeVisible();
    expect(screen.queryByText(/controlled transcript ·/i)).toBeNull();
    expect(screen.getByRole('list', { name: 'Live transcript segments' })).toBeVisible();
  });

  it('claims on-device / no-upload only when native confirms the on-device recognizer', () => {
    const { rerender } = render(<SessionScreen status="processing" segments={[]} captureActive />);
    expect(screen.queryByText(/not uploaded/i)).toBeNull();
    expect(screen.getByText(/may use an online service.*only text is sent to DSN/i)).toBeVisible();
    rerender(<SessionScreen status="processing" segments={[]} captureActive captureOnDevice />);
    expect(screen.getByText(/on-device recognizer; the audio is not uploaded/i)).toBeVisible();
  });

  it('never implies or offers microphone capture', () => {
    render(<SessionScreen status="processing" segments={[]} />);
    expect(screen.queryByText(/record(ing)? your (call|voice)/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /microphone|start recording/i })).toBeNull();
  });

  it('renders accepted segments in order with speaker and text', () => {
    render(
      <SessionScreen
        status="processing"
        segments={[
          { id: 's1', order: 1, speaker: 'caller', text: "I am from Demo Bank's fraud team." },
          { id: 's2', order: 2, speaker: 'caller', text: 'Transfer ₹50,000 to safe-new.' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/caller.*segment 1/i);
    expect(items[0]).toHaveTextContent("I am from Demo Bank's fraud team.");
    expect(items[1]).toHaveTextContent(/caller.*segment 2/i);
    expect(items[1]).toHaveTextContent('Transfer ₹50,000 to safe-new.');
  });

  it('no longer renders the untrusted-input caption', () => {
    render(<SessionScreen status="processing" segments={[]} />);
    expect(screen.queryByText(/transcript text is untrusted input/i)).toBeNull();
  });

  it('offers Stop processing only during live capture, and lets the user stop it', async () => {
    const onStopProcessing = vi.fn();
    const user = userEvent.setup();
    // Web (no live capture): there is nothing to stop, so no dead control is shown.
    const { rerender } = render(<SessionScreen status="processing" segments={[]} onStopProcessing={onStopProcessing} />);
    expect(screen.queryByRole('button', { name: /stop processing/i })).toBeNull();

    // Native capturing: the control appears and works.
    rerender(<SessionScreen status="processing" segments={[]} captureActive onStopProcessing={onStopProcessing} />);
    await user.click(screen.getByRole('button', { name: /stop processing/i }));
    expect(onStopProcessing).toHaveBeenCalled();
  });
});
