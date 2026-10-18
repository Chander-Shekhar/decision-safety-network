import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling, type PollDelay } from './usePolling';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncs on start and then on each interval while visible', async () => {
    const sync = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling(sync, true, 1000));
    expect(sync).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(sync).toHaveBeenCalledTimes(4);
  });

  it('pauses while the tab is hidden and syncs immediately when it returns', async () => {
    const sync = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling(sync, true, 1000));
    act(() => setVisibility('hidden'));
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(sync).toHaveBeenCalledTimes(1);
    act(() => setVisibility('visible'));
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('stops polling when the delay becomes null without an extra read', async () => {
    const sync = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ delay }: { delay: PollDelay }) => usePolling(sync, true, delay), {
      initialProps: { delay: 1000 as PollDelay },
    });
    rerender({ delay: null });
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('backs off according to how long the tab has been visible', async () => {
    const sync = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling(sync, true, (visibleForMs) => (visibleForMs < 5000 ? 1000 : 10_000)));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    const fastCalls = sync.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(sync.mock.calls.length - fastCalls).toBeLessThanOrEqual(2);
  });

  it('does nothing when disabled', async () => {
    const sync = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling(sync, false, 1000));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(sync).not.toHaveBeenCalled();
  });
});
