import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const command = vi.fn();
const get = vi.fn();
vi.mock('./api-client', async (orig) => ({
  ...(await orig<typeof import('./api-client')>()),
  createApiClient: () => ({ command, get, download: vi.fn() }),
}));
import { App, type AuthProvider } from './App';

const auth: AuthProvider = { signInSynthetic: vi.fn().mockResolvedValue(undefined), getIdToken: vi.fn().mockResolvedValue('t') };

beforeEach(() => {
  command.mockReset();
  get.mockReset();
  window.history.pushState({}, '', '/');
});

describe('App', () => {
  it('shows exactly one consolidated simulation disclosure in the header', () => {
    render(<App auth={auth} />);
    expect(screen.getAllByText(/simulated/i)).toHaveLength(1);
    expect(screen.getByText(/Prototype.*Demo Bank and the transfer are simulated; all data is synthetic/i)).toBeVisible();
  });

  it('fetches the case once the owner is signed in and the URL carries a caseId', async () => {
    window.history.pushState({}, '', '/cases/c1');
    get.mockResolvedValue({ id: 'c1', version: 2, phase: 'Observe', facts: {}, confirmed: {} });
    render(<App auth={auth} />);
    await userEvent.click(screen.getByRole('button', { name: /synthetic user/i }));
    await waitFor(() => expect(get).toHaveBeenCalledWith('cases/c1'));
  });

  it('blocks Verify from an Observe-phase case: shows guidance and fires no verify call', async () => {
    window.history.pushState({}, '', '/cases/c1');
    get.mockImplementation(async (path: string) =>
      path === 'registry/demo-bank'
        ? { entries: [] }
        : { id: 'c1', version: 2, phase: 'Observe', facts: { payee: { field: 'payee', value: 'x', sourceSegmentIds: ['seg-1'] } }, confirmed: {} },
    );
    render(<App auth={auth} />);
    await userEvent.click(screen.getByRole('button', { name: /synthetic user/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^Verify/ })); // step nav (no API call)
    expect(await screen.findByText(/submit the transfer/i)).toBeInTheDocument();
    expect(command).not.toHaveBeenCalledWith('POST', 'cases/c1/verify', expect.anything());
  });

  it('ingests a dsn:sms-signal posted into the window and shows it in the decision view', async () => {
    window.history.pushState({}, '', '/cases/c1');
    get.mockResolvedValue({ id: 'c1', version: 2, phase: 'Observe', facts: {}, confirmed: {} });
    render(<App auth={auth} />);
    await userEvent.click(screen.getByRole('button', { name: /synthetic user/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^Decision/ }));
    window.postMessage(JSON.stringify({ type: 'dsn:sms-signal', from: 'VM-DEMOBK', body: 'blocked, call now', receivedAt: '2026-10-07T10:00:00.000Z' }), '*');
    expect(await screen.findByText(/incoming sms/i)).toBeVisible();
  });

  it('on the Decision step, ignores foreign and malformed messages (listener is mounted but rejects)', async () => {
    window.history.pushState({}, '', '/cases/c1');
    get.mockResolvedValue({ id: 'c1', version: 2, phase: 'Observe', facts: {}, confirmed: {} });
    render(<App auth={auth} />);
    await userEvent.click(screen.getByRole('button', { name: /synthetic user/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^Decision/ }));
    // A foreign message and a malformed dsn envelope (missing `from`) must both be dropped.
    window.postMessage(JSON.stringify({ type: 'webpackHotUpdate' }), '*');
    window.postMessage(JSON.stringify({ type: 'dsn:sms-signal', body: 'no sender', receivedAt: '2026-10-07T10:00:00.000Z' }), '*');
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/incoming sms/i)).toBeNull();
  });
});

describe('App · live transcript bridge (DSN-025)', () => {
  const seg = (text: string, at: string) => JSON.stringify({ type: 'dsn:transcript-segment', text, at });

  async function openSession() {
    window.history.pushState({}, '', '/cases/c1');
    get.mockResolvedValue({ id: 'c1', version: 2, phase: 'Observe', facts: {}, confirmed: {} });
    command.mockResolvedValue({});
    render(<App auth={auth} />);
    await userEvent.click(screen.getByRole('button', { name: /synthetic user/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^Session/ }));
  }

  it('ingests a dsn:transcript-segment through the same segment API and then extracts', async () => {
    await openSession();
    window.postMessage(seg('Move 50,000 to the safe account now', '2026-10-12T10:00:00.000Z'), '*');
    expect(await screen.findByText('Move 50,000 to the safe account now')).toBeVisible();
    await waitFor(() => expect(command).toHaveBeenCalledWith('POST', 'cases/c1/segments', { id: 'seg-1', order: 1, speaker: 'caller', text: 'Move 50,000 to the safe account now' }));
    await waitFor(() => expect(command).toHaveBeenCalledWith('POST', 'cases/c1/facts/extract', expect.anything()));
  });

  it('shows the prototype-capture label only after native reports capture active', async () => {
    await openSession();
    expect(screen.queryByText(/prototype capture/i)).toBeNull();
    window.postMessage(JSON.stringify({ type: 'dsn:capture-status', active: true }), '*');
    expect(await screen.findByText(/prototype capture/i)).toBeVisible();
    window.postMessage(JSON.stringify({ type: 'dsn:capture-status', active: false }), '*');
    await waitFor(() => expect(screen.queryByText(/prototype capture/i)).toBeNull());
  });

  it('ignores malformed/foreign envelopes and does nothing without an open case', async () => {
    await openSession();
    window.postMessage(JSON.stringify({ type: 'webpackHotUpdate' }), '*');
    window.postMessage(JSON.stringify({ type: 'dsn:transcript-segment', at: '2026-10-12T10:00:00.000Z' }), '*');
    await new Promise((r) => setTimeout(r, 0));
    expect(command).not.toHaveBeenCalledWith('POST', 'cases/c1/segments', expect.anything());
  });

  it('is inert before a case exists (plain browser / no session)', async () => {
    window.history.pushState({}, '', '/');
    render(<App auth={auth} />);
    window.postMessage(seg('hello', '2026-10-12T10:00:00.000Z'), '*');
    await new Promise((r) => setTimeout(r, 0));
    expect(command).not.toHaveBeenCalledWith('POST', expect.stringContaining('/segments'), expect.anything());
  });
});

describe('App · first-run setup (DSN-023)', () => {
  const configuredPlan = {
    callListening: 'per-call',
    processingConsent: false,
    bankAccounts: [{ id: 'a1', label: 'Demo Savings', last4: '4821' }],
    thresholdMinor: 500000,
    retentionMode: 'facts-24h',
    exportConsent: false,
    setupCompletedAt: '2026-10-11T00:00:00.000Z',
  };

  it('routes a fresh owner (no plan) into setup, and completing it persists the plan and lands on home', async () => {
    const { ApiError } = await import('./api-client');
    get.mockRejectedValue(new ApiError(404, 'NOT_FOUND'));
    command.mockImplementation(async (_m: string, _p: string, body: object) => ({ ...configuredPlan, ...body }));
    render(<App auth={auth} />);
    await userEvent.click(screen.getByRole('button', { name: /synthetic user/i }));

    expect(await screen.findByRole('region', { name: 'First-run setup' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Journey' })).toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: /unverified numbers only/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Finish setup' }));

    expect(await screen.findByRole('region', { name: 'Home' })).toBeVisible();
    expect(command).toHaveBeenCalledWith(
      'PUT',
      'plan',
      expect.objectContaining({ callListening: 'unverified-only', completeSetup: true, bankId: 'demo-bank' }),
    );
    expect(screen.queryByRole('region', { name: 'First-run setup' })).toBeNull();
  });

  it('on a non-404 plan load failure shows a retry instead of setup, and retry recovers', async () => {
    const { ApiError } = await import('./api-client');
    get.mockRejectedValueOnce(new ApiError(500, 'API_500')).mockResolvedValue(configuredPlan);
    render(<App auth={auth} />);
    await userEvent.click(screen.getByRole('button', { name: /synthetic user/i }));
    expect(await screen.findByText(/couldn.t load your safety plan/i)).toBeVisible();
    expect(screen.queryByRole('region', { name: 'First-run setup' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('region', { name: 'Home' })).toBeVisible();
  });

  it('lands an already-configured owner directly on home, skipping setup', async () => {
    get.mockResolvedValue(configuredPlan);
    render(<App auth={auth} />);
    await userEvent.click(screen.getByRole('button', { name: /synthetic user/i }));
    expect(await screen.findByRole('region', { name: 'Home' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'First-run setup' })).toBeNull();
  });
});
