import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AllyScreen } from './AllyScreen';
import { AllySharePreview } from './AllySharePreview';
import type { AllyPacket, AllyPacketContent } from '../../../packages/contracts/src/ally';

const packet: AllyPacket = {
  caseId: 'case-1',
  expiresAt: '2026-10-05T10:00:00.000Z',
  claim: 'Account compromised',
  proposedAction: 'Transfer to a safe account',
  amountMinor: 5_000_000,
  verificationGap: 'Caller not independently verified',
  summary: 'A caller contacted them, claiming account compromised. The caller has not been independently verified.',
};
const content: AllyPacketContent = {
  claim: packet.claim,
  proposedAction: packet.proposedAction,
  amountMinor: packet.amountMinor,
  verificationGap: packet.verificationGap,
  summary: packet.summary,
};

describe('Ally reach (DSN-027)', () => {
  it('owner preview offers a prepare button, then a human-opened WhatsApp link with the summary text', async () => {
    const onPrepare = vi.fn();
    const { rerender } = render(<AllySharePreview allyName="Asha" packet={content} onPrepareWhatsApp={onPrepare} />);
    expect(screen.queryByRole('link')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /prepare whatsapp summary/i }));
    expect(onPrepare).toHaveBeenCalledTimes(1);

    rerender(
      <AllySharePreview
        allyName="Asha"
        packet={content}
        whatsappSummary={{ caseId: 'case-1', text: 'Caller claimed: Account compromised', url: 'https://wa.me/?text=x', expiresAt: packet.expiresAt }}
      />,
    );
    const link = screen.getByRole('link', { name: /open whatsapp/i });
    expect(link).toHaveAttribute('href', 'https://wa.me/?text=x');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText(/nothing is sent until you tap/i)).toBeVisible();
  });

  it('ally gets a contact-the-caller action that shows a script with no money or certification control', async () => {
    const onContact = vi.fn();
    const { rerender } = render(<AllyScreen packet={packet} onContactCaller={onContact} />);
    await userEvent.click(screen.getByRole('button', { name: /contact the caller/i }));
    expect(onContact).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link')).toBeNull();

    rerender(
      <AllyScreen
        packet={packet}
        onContactCaller={onContact}
        callerContact={{ caseId: 'case-1', script: 'I am the Safety Ally for someone.', canControlFunds: false, canCertifyCaller: false }}
      />,
    );
    expect(screen.getByText(/I am the Safety Ally for someone/)).toBeVisible();
    expect(screen.getByText(/does not approve payments or confirm who the caller is/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /approve|certify|transfer|freeze/i })).toBeNull();
  });

  it('hides the contact action when not wired', () => {
    render(<AllyScreen packet={packet} />);
    expect(screen.queryByRole('button', { name: /contact the caller/i })).toBeNull();
  });
});
