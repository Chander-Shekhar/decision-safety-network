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

  it('ingests a dsn:sms-signal posted into the window and shows it on the Review step', async () => {
    window.history.pushState({}, '', '/cases/c1');
    get.mockResolvedValue({ id: 'c1', version: 2, phase: 'Observe', facts: {}, confirmed: {} });
    render(<App auth={auth} />);
    await userEvent.click(await screen.findByRole('button', { name: /^Review/ }));
    fromPage(JSON.stringify({ type: 'dsn:sms-signal', from: 'VM-DEMOBK', body: 'blocked, call now', receivedAt: '2026-10-07T10:00:00.000Z' }));
    expect(await screen.findByText(/incoming sms/i)).toBeVisible();
  });

  it('on the Review step, ignores foreign and malformed messages (listener is mounted but rejects)', async () => {
    window.history.pushState({}, '', '/cases/c1');
    get.mockResolvedValue({ id: 'c1', version: 2, phase: 'Observe', facts: {}, confirmed: {} });
    render(<App auth={auth} />);
    await userEvent.click(await screen.findByRole('button', { name: /^Review/ }));
    // A foreign message and a malformed dsn envelope (missing `from`) must both be dropped.
    fromPage(JSON.stringify({ type: 'webpackHotUpdate' }));
    fromPage(JSON.stringify({ type: 'dsn:sms-signal', body: 'no sender', receivedAt: '2026-10-07T10:00:00.000Z' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/incoming sms/i)).toBeNull();
  });

  it('splits the old Decision step into Review → Decide → Pay, each its own screen', async () => {
    window.history.pushState({}, '', '/cases/c1');
    get.mockResolvedValue({
      id: 'c1',
      version: 2,
      phase: 'Observe',
      facts: { payee: { field: 'payee', value: 'safe-new', sourceSegmentIds: ['seg-1'], origin: 'model', uncertainty: 'low' } },
      confirmed: {},
    });
    render(<App auth={auth} />);

    // Lands on Review: the Decision Map and optional checks, but not the decide console or the payment form.
    expect(await screen.findByRole('region', { name: 'Decision Map' })).toBeVisible();
    expect(screen.getByRole('button', { name: /run a check/i })).toBeVisible();
    expect(screen.queryByRole('heading', { name: /decide what to do/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /save transfer draft/i })).toBeNull();

    // Decide is its own screen: the action console, not the map or the payment form.
    await userEvent.click(screen.getByRole('button', { name: /^Decide/ }));
    expect(screen.getByRole('heading', { name: /decide what to do/i })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Decision Map' })).toBeNull();
    expect(screen.queryByRole('button', { name: /save transfer draft/i })).toBeNull();

    // Pay is its own screen: the transfer form shown directly (no disclosure to open).
    await userEvent.click(screen.getByRole('button', { name: /^Pay/ }));
    expect(screen.getByRole('button', { name: /save transfer draft/i })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Decision Map' })).toBeNull();
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

  it('shows only the call input before a call is added, then only the transcript (with an edit path) after', async () => {
    await openSession();
    // Before a call: just the "Add the call" input, no competing transcript panel.
    expect(screen.getByRole('tab', { name: 'Paste transcript' })).toBeVisible();
    expect(screen.getByLabelText(/paste the call/i)).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Live session' })).toBeNull();

    // Add a call via the live bridge: the transcript appears and the input collapses behind an
    // explicit edit affordance. (Moving on is the footer's Next, not a per-step button.)
    fromPage(seg('Move 50,000 to the safe account now', '2026-10-12T10:00:00.000Z'));
    expect(await screen.findByRole('region', { name: 'Live session' })).toBeVisible();
    expect(screen.queryByLabelText(/paste the call/i)).toBeNull();
    expect(screen.getByRole('button', { name: /add or edit the call/i })).toBeVisible();

    // The edit affordance brings the input back on demand.
    await userEvent.click(screen.getByRole('button', { name: /add or edit the call/i }));
    expect(screen.getByLabelText(/paste the call/i)).toBeVisible();
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
      // Stop processing only exists during live capture, so bring the session into that state first.
      fromPage(JSON.stringify({ type: 'dsn:capture-status', active: true }));
      await userEvent.click(await screen.findByRole('button', { name: /stop processing/i }));
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

  it('provides sequential Back/Next navigation through the journey steps', async () => {
    await openSession();
    // The footer shows where you are and offers a forward path.
    expect(screen.getByText('Step 2 of 9')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /next: review/i }));
    expect(await screen.findByRole('region', { name: 'Decision Map' })).toBeVisible();
    expect(screen.getByText('Step 3 of 9')).toBeVisible();
    // ...and a way back to the previous step.
    await userEvent.click(screen.getByRole('button', { name: /back to session/i }));
    expect(screen.getByText('Step 2 of 9')).toBeVisible();
  });
});

describe('App · ally session pairing', () => {
  it('discovers an invitation addressed to the ally, reflects it, and accepts via the API', async () => {
    window.history.pushState({}, '', '/?role=ally');
    get.mockImplementation(async (path: string) =>
      path === 'ally/invitations' ? { invitations: [{ id: 'inv-1', acceptedAt: null }] } : undefined,
    );
    command.mockResolvedValue({});
    render(<App auth={auth} />);

    await waitFor(() => expect(auth.signInSynthetic).toHaveBeenCalledWith('ally'));
    // The ally screen reacts to the incoming invitation (previously it never did).
    expect(await screen.findByText(/you've been invited/i)).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
    await waitFor(() => expect(command).toHaveBeenCalledWith('POST', 'ally-invitations/inv-1/accept'));
    expect(await screen.findByText(/you're connected as a safety ally/i)).toBeVisible();
  });

  it('shows a waiting state (no actionable accept) when no invitation has arrived yet', async () => {
    window.history.pushState({}, '', '/?role=ally');
    get.mockResolvedValue({ invitations: [] });
    render(<App auth={auth} />);
    await waitFor(() => expect(auth.signInSynthetic).toHaveBeenCalledWith('ally'));
    expect(await screen.findByText(/waiting for an invitation/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeDisabled();
  });
});

describe('App · owner reflects ally acceptance', () => {
  const nominatedPlan = {
    callListening: 'per-call',
    processingConsent: false,
    allySharingConsent: true,
    allyShareFields: ['claim'],
    bankAccounts: [{ id: 'a1', label: 'Everyday Savings', last4: '4821' }],
    thresholdMinor: 500000,
    retentionMode: 'facts-24h',
    exportConsent: false,
    setupCompletedAt: '2026-10-11T00:00:00.000Z',
    // A real nomination is stored on the plan; this clears the sample ally and
    // turns on the owner invitation poll.
    nominatedAllyUid: 'ally-1',
  };

  it('polls the owner-keyed invitation read and shows the ally ready once accepted', async () => {
    get.mockImplementation(async (path: string) =>
      path === 'owner/invitations'
        ? { invitations: [{ id: 'inv-1', allyUid: 'ally-1', acceptedAt: '2026-10-15T00:00:00.000Z' }] }
        : nominatedPlan,
    );
    render(<App auth={auth} />);

    await waitFor(() => expect(get).toHaveBeenCalledWith('owner/invitations'));
    // Previously the owner sat at "awaiting acceptance" forever; now it reflects acceptance.
    expect(await screen.findByText(/ally ready/i)).toBeVisible();
    expect(screen.queryByText(/awaiting acceptance/i)).toBeNull();
  });

  it('shows "awaiting acceptance" while the nominated ally has not yet accepted', async () => {
    get.mockImplementation(async (path: string) =>
      path === 'owner/invitations'
        ? { invitations: [{ id: 'inv-1', allyUid: 'ally-1', acceptedAt: null }] }
        : nominatedPlan,
    );
    render(<App auth={auth} />);

    await waitFor(() => expect(get).toHaveBeenCalledWith('owner/invitations'));
    expect(await screen.findByText(/awaiting acceptance/i)).toBeVisible();
    expect(screen.queryByText(/ally ready/i)).toBeNull();
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
