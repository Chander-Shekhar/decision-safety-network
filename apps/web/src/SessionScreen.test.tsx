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

  it('never implies microphone or always-on capture', () => {
    render(<SessionScreen status="processing" segments={[]} />);
    expect(screen.getByText(/no microphone or always-on capture/i)).toBeVisible();
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

  it('marks transcript text as untrusted input', () => {
    render(<SessionScreen status="processing" segments={[]} />);
    expect(screen.getByText(/transcript text is untrusted input/i)).toBeVisible();
  });

  it('lets the user stop processing', async () => {
    const onStopProcessing = vi.fn();
    const user = userEvent.setup();
    render(<SessionScreen status="processing" segments={[]} onStopProcessing={onStopProcessing} />);

    await user.click(screen.getByRole('button', { name: /stop processing/i }));
    expect(onStopProcessing).toHaveBeenCalled();
  });
});
