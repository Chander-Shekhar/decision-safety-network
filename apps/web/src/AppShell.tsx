import { useState, type ReactNode } from 'react';
import { Drawer } from './ui';

export type AppView = 'home' | 'cases' | 'settings' | 'about';

const NAV: { view: AppView; label: string }[] = [
  { view: 'home', label: 'Home' },
  { view: 'cases', label: 'Cases' },
  { view: 'settings', label: 'Settings' },
  { view: 'about', label: 'About this demo' },
];

/** Short labels for the breadcrumb trail (the menu uses the fuller NAV labels). */
const CRUMB_LABEL: Record<Exclude<AppView, 'home'>, string> = {
  cases: 'Cases',
  settings: 'Settings',
  about: 'About',
};

export interface AppShellProps {
  /** Highlighted nav item (owner mode only). */
  view: AppView;
  onNavigate: (view: AppView) => void;
  /** Ally mode: a minimal bar with a way back to the owner view. */
  allyMode?: boolean;
  onExitAllyView?: () => void;
  /** App-level banner (e.g. an error Callout) rendered under the top bar. */
  banner?: ReactNode;
  children: ReactNode;
}

/**
 * The mobile app frame: a centered single column (max 480px) with a sticky top
 * bar and a burger-menu navigation Drawer. Every screen renders inside this so
 * the web build reads as a mobile app. Ally mode strips navigation to a title
 * plus a return path, since an ally only ever sees a shared case.
 */
export function AppShell({ view, onNavigate, allyMode = false, onExitAllyView, banner, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  function go(next: AppView): void {
    onNavigate(next);
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-surface text-text">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-surface shadow-sm sm:border-x sm:border-border">
        <header role="banner" className="sticky top-0 z-30 flex items-center gap-space-3 border-b border-border bg-surface-raised px-space-3 py-space-3">
          {allyMode ? (
            <button
              type="button"
              onClick={onExitAllyView}
              className="rounded-md px-space-2 py-space-1 text-sm text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              ← My view
            </button>
          ) : (
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="rounded-md px-space-2 py-space-1 text-xl leading-none hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              ☰
            </button>
          )}
          {allyMode ? (
            <>
              <span className="flex min-w-0 items-center gap-space-2">
                <img src="/brand/second-voice-mark.png" alt="" aria-hidden="true" className="h-6 w-6 shrink-0" />
              <span className="truncate font-semibold tracking-tight">Second Voice</span>
              </span>
              <span className="ml-auto whitespace-nowrap text-sm text-text-muted">Safety Ally</span>
            </>
          ) : view === 'home' ? (
            // Home is the root: no "up" to show, so keep the wordmark here.
            <span className="flex min-w-0 items-center gap-space-2">
              <img src="/brand/second-voice-mark.png" alt="" aria-hidden="true" className="h-6 w-6 shrink-0" />
              <span className="truncate font-semibold tracking-tight">Second Voice</span>
            </span>
          ) : (
            // Secondary views (Settings/Cases/About) get a trail back to Home.
            // Small, single-line, and truncating so it never overlaps the burger.
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex items-center gap-space-1 overflow-hidden text-sm">
                <li className="shrink-0">
                  <button
                    type="button"
                    onClick={() => go('home')}
                    className="rounded px-space-1 text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Home
                  </button>
                </li>
                <li aria-hidden="true" className="shrink-0 text-text-muted">
                  ›
                </li>
                <li aria-current="page" className="truncate font-semibold">
                  {CRUMB_LABEL[view]}
                </li>
              </ol>
            </nav>
          )}
        </header>

        {banner && <div className="px-space-3 pt-space-3">{banner}</div>}

        <main className="flex min-w-0 flex-1 flex-col gap-space-4 p-space-3">{children}</main>
      </div>

      {!allyMode && (
        <Drawer open={menuOpen} onOpenChange={setMenuOpen} title="Menu">
          <nav aria-label="Main" className="flex flex-col gap-space-1">
            {NAV.map((item) => (
              <button
                key={item.view}
                type="button"
                aria-current={view === item.view ? 'page' : undefined}
                onClick={() => go(item.view)}
                className={`rounded-md px-space-3 py-space-2 text-left text-base hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  view === item.view ? 'bg-surface-sunken font-semibold' : ''
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </Drawer>
      )}
    </div>
  );
}
