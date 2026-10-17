import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsScreen } from './SettingsScreen';

function renderSettings(overrides: Partial<React.ComponentProps<typeof SettingsScreen>> = {}) {
  const onSave = vi.fn();
  render(
    <SettingsScreen allyStatus="ready" allyName="Priya Nair" onSave={onSave} {...overrides} />,
  );
  return { onSave };
}

describe('SettingsScreen', () => {
  it('consolidates the essentials: listening modes, the paired ally by name, and a pre-added account', () => {
    renderSettings();
    expect(screen.getByRole('radio', { name: /all calls/i })).toBeVisible();
    expect(screen.getByRole('radio', { name: /unverified numbers only/i })).toBeVisible();
    expect(screen.getByRole('radio', { name: /decide at each call/i })).toBeVisible();
    expect(screen.getByText(/Priya Nair · ready to help/i)).toBeVisible();
    expect(screen.getByText(/ending 4821/i)).toBeVisible();
  });

  it('lets the owner save their own name and mobile', async () => {
    const user = userEvent.setup();
    const onSaveProfile = vi.fn();
    renderSettings({ onSaveProfile, profile: { displayName: 'Ravi', mobile: '9876543210' } });
    expect(screen.getByLabelText(/your name/i)).toHaveValue('Ravi');
    await user.clear(screen.getByLabelText(/your mobile number/i));
    await user.type(screen.getByLabelText(/your mobile number/i), '+91 98765 43211');
    await user.click(screen.getByRole('button', { name: /save my details/i }));
    expect(onSaveProfile).toHaveBeenCalledWith({ displayName: 'Ravi', mobile: '+91 98765 43211' });
  });

  it('shows no ally yet when none is connected, and no sample ally', () => {
    renderSettings({ allyStatus: 'none', allyName: undefined });
    expect(screen.getByText(/no ally connected yet/i)).toBeVisible();
    expect(screen.queryByText(/sample/i)).toBeNull();
  });

  it('keeps less-common privacy controls under Advanced', () => {
    renderSettings();
    // Retention lives under Advanced, which is collapsed by default.
    expect(screen.queryByText(/keep after the session/i)).toBeNull();
  });

  it('saves the collected settings, including an optional ally pairing code', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettings();

    await user.click(screen.getByRole('radio', { name: /all calls/i }));
    await user.type(screen.getByLabelText(/connect your own ally/i), 'PAIR-99');
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const values = onSave.mock.calls[0][0];
    expect(values).toMatchObject({ callListening: 'all-calls', allyPairingCode: 'PAIR-99' });
    expect(values.bankAccounts.map((a: { last4: string }) => a.last4)).toContain('4821');
  });

  it('omits the pairing code when none is entered', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettings();
    await user.click(screen.getByRole('button', { name: /save settings/i }));
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('allyPairingCode');
  });
});
