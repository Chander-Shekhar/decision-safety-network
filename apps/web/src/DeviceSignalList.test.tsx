import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DeviceSignalList } from './DeviceSignalList';

const sig = { id: 'VM-DEMOBK|2026-10-07T10:00:00.000Z', from: 'VM-DEMOBK', body: 'Pay Rs 50000 to new a/c to keep funds safe', receivedAt: '2026-10-07T10:00:00.000Z' };

describe('DeviceSignalList', () => {
  it('shows the SMS as a received message claim with provenance and sender', () => {
    render(<DeviceSignalList signals={[sig]} />);
    expect(screen.getByText(/incoming sms/i)).toBeVisible();
    expect(screen.getByText(/VM-DEMOBK/)).toBeVisible();
    expect(screen.getByText(/message received on device/i)).toBeVisible();
  });
  it('frames the message as a claim, never as paid or verified', () => {
    render(<DeviceSignalList signals={[sig]} />);
    expect(screen.getByText(/not a verified fact|claim/i)).toBeVisible();
    // The disclaimer itself says "not a verified fact"; the signal item must never claim paid/verified.
    expect(within(screen.getByRole('listitem')).queryByText(/\bpaid\b|\bverified\b/i)).toBeNull();
  });
  it('renders nothing when there are no signals', () => {
    const { container } = render(<DeviceSignalList signals={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
