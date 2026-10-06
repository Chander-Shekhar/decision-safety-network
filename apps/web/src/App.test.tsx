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
    expect(await screen.findByText(/submit the simulated transfer/i)).toBeInTheDocument();
    expect(command).not.toHaveBeenCalledWith('POST', 'cases/c1/verify', expect.anything());
  });
});
