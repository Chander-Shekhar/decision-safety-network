import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell';

describe('AppShell · breadcrumb navigation', () => {
  it('shows a Home breadcrumb on a secondary view and navigates up when clicked', async () => {
    const onNavigate = vi.fn();
    render(
      <AppShell view="settings" onNavigate={onNavigate}>
        <p>settings body</p>
      </AppShell>,
    );

    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    // The current location is marked and the parent is a real way back.
    expect(within(crumbs).getByText('Settings')).toHaveAttribute('aria-current', 'page');
    await userEvent.click(within(crumbs).getByRole('button', { name: 'Home' }));
    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  it('maps each secondary view to its short crumb label', () => {
    const { rerender } = render(
      <AppShell view="cases" onNavigate={vi.fn()}>
        <p />
      </AppShell>,
    );
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Cases')).toBeVisible();

    rerender(
      <AppShell view="about" onNavigate={vi.fn()}>
        <p />
      </AppShell>,
    );
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('About')).toBeVisible();
  });

  it('shows the wordmark and no breadcrumb at the Home root', () => {
    render(
      <AppShell view="home" onNavigate={vi.fn()}>
        <p />
      </AppShell>,
    );
    expect(screen.getByRole('banner')).toHaveTextContent('Decision Safety Network');
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });

  it('in ally mode shows the return path and no breadcrumb or burger', () => {
    const onExitAllyView = vi.fn();
    render(
      <AppShell view="home" onNavigate={vi.fn()} allyMode onExitAllyView={onExitAllyView}>
        <p />
      </AppShell>,
    );
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(screen.queryByRole('button', { name: /open menu/i })).toBeNull();
    expect(screen.getByRole('button', { name: /my view/i })).toBeVisible();
  });
});
