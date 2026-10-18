import { useEffect } from 'react';

/** Delay before the next poll, given how long the tab has been visible; null stops polling. */
export type PollDelay = number | null | ((visibleForMs: number) => number);

// Each poll is a billed API request plus a Firestore read, so polling only runs
// while the tab is visible. `sync` always runs once on start and again whenever
// the tab becomes visible, even when `delay` is null, so a returning user sees
// fresh state; changing `delay` only reschedules and never forces an extra read.
export function usePolling(sync: () => Promise<void>, enabled: boolean, delay: PollDelay): void {
  useEffect(() => {
    if (!enabled) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    void sync();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [sync, enabled]);

  useEffect(() => {
    if (!enabled || delay === null) return;
    let stopped = false;
    let timer: number | undefined;
    let visibleSince = Date.now();

    const schedule = () => {
      window.clearTimeout(timer);
      timer = undefined;
      if (stopped || document.visibilityState === 'hidden') return;
      const ms = typeof delay === 'function' ? delay(Date.now() - visibleSince) : delay;
      timer = window.setTimeout(() => {
        void sync().finally(schedule);
      }, ms);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') visibleSince = Date.now();
      schedule();
    };

    schedule();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [sync, enabled, delay]);
}
