import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const command = vi.fn();
const get = vi.fn();
vi.mock('./api-client', async (orig) => ({
  ...(await orig<typeof import('./api-client')>()),
  createApiClient: () => ({ command, get, download: vi.fn() }),
}));
import { App, type AuthProvider } from './App';

const auth: AuthProvider = { signInSynthetic: vi.fn().mockResolvedValue(undefined), getIdToken: vi.fn().mockResolvedValue('t') };

// jsdom's window.postMessage leaves event.source null; a real WebView injectJavaScript postMessage has source === window.
const fromPage = (data: string) => window.dispatchEvent(new MessageEvent('message', { data, source: window }));

beforeEach(() => {
  command.mockReset();
  get.mockReset();
  (auth.signInSynthetic as ReturnType<typeof vi.fn>).mockClear();
  window.history.pushState({}, '', '/');
});

describe('App', () => {
  it('auto-opens into the app with no role picker and no demo/synthetic disclaimer in the chrome', async () => {
    get.mockResolvedValue(undefined);
    render(<App auth={auth} />);
    // Owner is signed in automatically; there is no "Create synthetic user/ally" picker.
    await waitFor(() => expect(auth.signInSynthetic).toHaveBeenCalledWith('owner'));
    expect(screen.queryByRole('button', { name: /create synthetic/i })).toBeNull();
    expect(screen.queryByText(/all data is synthetic/i)).toBeNull();
    expect(screen.queryByText(/\bprototype\b/i)).toBeNull();
    // The mobile shell wordmark is present.
    expect(screen.getByRole('banner')).toHaveTextContent('Decision Safety Network');
  });

  it('exposes burger-menu navigation to Settings, Cases, and About', async () => {
    get.mockResolvedValue(undefined);
    render(<App auth={auth} />);
    await userEvent.click(await screen.findByRole('button', { name: /open menu/i }));
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('button', { name: 'Settings' })).toBeVisible();
    expect(within(nav).getByRole('button', { name: 'Cases' })).toBeVisible();
    expect(within(nav).getByRole('button', { name: 'About this demo' })).toBeVisible();
  });

  it('fetches the case once signed in and the URL carries a caseId', async () => {
    window.history.pushState({}, '', '/cases/c1');
    get.mockResolvedValue({ id: 'c1', version: 2, phase: 'Observe', facts: {}, confirmed: {} });
    render(<App auth={auth} />);
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
    await userEvent.click(await screen.findByRole('button', { name: /^Verify/ })); // step nav (no API call)
    expect(await screen.findByText(/submit the transfer/i)).toBeInTheDocument();
    expect(command).not.toHaveBeenCalledWith('POST', 'cases/c1/verify', expect.anything());
  });

  it('ingests a dsn:sms-signal posted into the window and shows it in the decision view', async () => {
    window.history.pushState({}, '', '/cases/c1');
    get.mockResolvedValue({ id: 'c1', version: 2, phase: 'Observe', facts: {}, confirmed: {} });
    render(<App auth={auth} />);
    await userEvent.click(await screen.findByRole('button', { name: /^Decision/ }));
    fromPage(JSON.stringify({ type: 'dsn:sms-signal', from: 'VM-DEMOBK', body: 'blocked, call now', receivedAt: '2026-10-07T10:00:00.000Z' }));
    expect(await screen.findByText(/incoming sms/i)).toBeVisible();
  });

  it('on the Decision step, ignores foreign and malformed messages (listener is mounted but rejects)', async () => {
    window.history.pushState({}, '', '/cases/c1');
    get.mockResolvedValue({ id: 'c1', version: 2, phase: 'Observe', facts: {}, confirmed: {} });
    render(<App auth={auth} />);
    await userEvent.click(await screen.findByRole('button', { name: /^Decision/ }));
    // A foreign message and a malformed dsn envelope (missing `from`) must both be dropped.
    fromPage(JSON.stringify({ type: 'webpackHotUpdate' }));
    fromPage(JSON.stringify({ type: 'dsn:sms-signal', body: 'no sender', receivedAt: '2026-10-07T10:00:00.000Z' }));
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
    await userEvent.click(await screen.findByRole('button', { name: /^Session/ }));
  }

  it('gives a web owner a way to bring the call in on the Session step (paste/upload switcher)', async () => {
    await openSession();
    // The Session step is not a dead wait-screen on the web: the "Add the call" switcher is present
    // and a route onward to the decision is offered.
    expect(screen.getByRole('tab', { name: 'Paste transcript' })).toBeVisible();
    expect(screen.getByLabelText(/paste the call/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /go to the decision/i })).toBeVisible();
  });

  it('ingests a dsn:transcript-segment through the same segment API and then extracts', async () => {
    await openSession();
    fromPage(seg('Move 50,000 to the safe account now', '2026-10-12T10:00:00.000Z'));
    expect(await screen.findByText('Move 50,000 to the safe account now')).toBeVisible();
    await waitFor(() => expect(command).toHaveBeenCalledWith('POST', 'cases/c1/segments', { id: 'seg-1', order: 1, speaker: 'caller', text: 'Move 50,000 to the safe account now' }));
    await waitFor(() => expect(command).toHaveBeenCalledWith('POST', 'cases/c1/facts/extract', expect.anything()));
  });

  it('shows the live-capture label only after native reports capture active', async () => {
    await openSession();
    expect(screen.queryByText(/microphone on speakerphone/i)).toBeNull();
    fromPage(JSON.stringify({ type: 'dsn:capture-status', active: true }));
    expect(await screen.findByText(/microphone on speakerphone/i)).toBeVisible();
    fromPage(JSON.stringify({ type: 'dsn:capture-status', active: false }));
    await waitFor(() => expect(screen.queryByText(/microphone on speakerphone/i)).toBeNull());
  });

  it('ignores malformed/foreign envelopes and does nothing without an open case', async () => {
    await openSession();
    fromPage(JSON.stringify({ type: 'webpackHotUpdate' }));
    fromPage(JSON.stringify({ type: 'dsn:transcript-segment', at: '2026-10-12T10:00:00.000Z' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(command).not.toHaveBeenCalledWith('POST', 'cases/c1/segments', expect.anything());
  });

  it('ignores envelopes whose source is not the page window (frames / other windows)', async () => {
    await openSession();
    window.dispatchEvent(new MessageEvent('message', { data: seg('injected', '2026-10-12T10:00:00.000Z'), source: null }));
    window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'dsn:sms-signal', from: 'x', body: 'y', receivedAt: 'z' }), source: null }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('injected')).toBeNull();
    expect(command).not.toHaveBeenCalledWith('POST', 'cases/c1/segments', expect.anything());
  });

  it('tells native to stop the mic (allowed:false) when processing is revoked', async () => {
    const post = vi.fn();
    (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView = { postMessage: post };
    try {
      await openSession();
      await userEvent.click(screen.getByRole('button', { name: /stop processing/i }));
      await waitFor(() => expect(command).toHaveBeenCalledWith('POST', 'cases/c1/processing/revoke'));
      await waitFor(() => {
        const last = JSON.parse(post.mock.calls[post.mock.calls.length - 1][0]);
        expect(last).toMatchObject({ type: 'dsn:capture-policy', allowed: false });
      });
    } finally {
      delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
    }
  });

  it('is inert before a case exists (plain browser / no session)', async () => {
    window.history.pushState({}, '', '/');
    get.mockResolvedValue(undefined);
    render(<App auth={auth} />);
    fromPage(seg('hello', '2026-10-12T10:00:00.000Z'));
    await new Promise((r) => setTimeout(r, 0));
    expect(command).not.toHaveBeenCalledWith('POST', expect.stringContaining('/segments'), expect.anything());
  });
});

describe('App · first-run setup (DSN-023)', () => {
  const configuredPlan = {
    callListening: 'per-call',
    processingConsent: false,
    allySharingConsent: true,
    allyShareFields: ['claim'],
    bankAccounts: [{ id: 'a1', label: 'Everyday Savings', last4: '4821' }],
    thresholdMinor: 500000,
    retentionMode: 'facts-24h',
    exportConsent: false,
    setupCompletedAt: '2026-10-11T00:00:00.000Z',
  };

  it('routes a fresh owner (no plan) into a first-run home, and completing setup in Settings persists the plan and lands on home', async () => {
    const { ApiError } = await import('./api-client');
    get.mockRejectedValue(new ApiError(404, 'NOT_FOUND'));
    command.mockImplementation(async (_m: string, _p: string, body: object) => ({ ...configuredPlan, ...body }));
    render(<App auth={auth} />);

    expect(await screen.findByText(/first time/i)).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Journey' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /go to settings/i }));
    expect(await screen.findByRole('region', { name: 'Settings' })).toBeVisible();
    await userEvent.click(screen.getByRole('radio', { name: /unverified numbers only/i }));
    await userEvent.click(screen.getByRole('button', { name: /save settings/i }));

    expect(await screen.findByRole('region', { name: 'Home' })).toBeVisible();
    expect(command).toHaveBeenCalledWith(
      'PUT',
      'plan',
      expect.objectContaining({ callListening: 'unverified-only', completeSetup: true, bankId: 'demo-bank' }),
    );
  });

  it('on a non-404 plan load failure shows a retry instead of first-run home, and retry recovers', async () => {
    const { ApiError } = await import('./api-client');
    get.mockRejectedValueOnce(new ApiError(500, 'API_500')).mockResolvedValue(configuredPlan);
    render(<App auth={auth} />);
    expect(await screen.findByText(/couldn.t load your settings/i)).toBeVisible();
    expect(screen.queryByText(/first time/i)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('region', { name: 'Home' })).toBeVisible();
  });

  it('lands an already-configured owner directly on home, skipping setup', async () => {
    get.mockResolvedValue(configuredPlan);
    render(<App auth={auth} />);
    expect(await screen.findByRole('region', { name: 'Home' })).toBeVisible();
    expect(screen.queryByText(/first time/i)).toBeNull();
  });
});
