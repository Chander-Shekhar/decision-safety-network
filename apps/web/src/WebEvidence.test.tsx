import { render, screen } from '@testing-library/react';
import { VerifyPanel } from './VerifyPanel';
import { DecisionMap } from './DecisionMap';
import type { Fact } from '../../../packages/contracts/src/facts';
import type { WebVerificationEvidence } from '../../../packages/contracts/src/web-verification';

// Public web evidence (DSN-026): labeled, untrusted supporting evidence only.

const registry = {
  id: 'demo-bank',
  version: 'cup-1',
  fictional: true as const,
  routeLabel: 'Demo Bank verification (simulated)',
  source: 'local fictional registry',
  reviewedAt: '2026-10-02',
};

const base = {
  institution: 'Demo Bank',
  maskedNumber: '+91 ••••• ••456',
  trust: 'untrusted' as const,
  source: 'curated-sample' as const,
  simulated: true as const,
  officialRoute: null,
  certifiesCaller: false as const,
  checkedAt: '2026-10-12T10:00:00.000Z',
};
const contradiction: WebVerificationEvidence = {
  ...base,
  stance: 'contradicts',
  headline: "Number does not match Demo Bank's published contact pattern",
  detail: 'Public listings for Demo Bank do not include numbers like this one.',
};
const corroboration: WebVerificationEvidence = {
  ...base,
  stance: 'corroborates',
  headline: 'Number fits a published Demo Bank contact pattern',
  detail: 'This only means the number looks plausible. It does not confirm who is calling.',
};

describe('VerifyPanel public web evidence', () => {
  it('labels a contradiction and a corroboration as not-verified public web evidence, by text and not color alone', () => {
    render(<VerifyPanel registry={registry} webEvidence={[contradiction, corroboration]} />);
    expect(screen.getByText(/public web evidence · not verified/i)).toBeVisible();
    expect(screen.getByText('Contradicts public listing')).toBeVisible();
    expect(screen.getByText('Fits public listing')).toBeVisible();
    expect(screen.getByText(/does not match Demo Bank/)).toBeVisible();
  });

  it('keeps the registry route as the only action: no extra buttons, links, or contact fields from web evidence', () => {
    render(<VerifyPanel registry={registry} webEvidence={[corroboration]} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /verify with demo bank/i })).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('renders nothing extra without evidence', () => {
    render(<VerifyPanel registry={registry} />);
    expect(screen.queryByLabelText(/public web evidence/i)).toBeNull();
  });
});

describe('DecisionMap public web evidence', () => {
  const identity: Fact = { field: 'claimedIdentity', value: 'Demo Bank fraud desk', origin: 'model', sourceSegmentIds: ['s1'], uncertainty: 'low' };
  const payee: Fact = { field: 'payee', value: 'safe-new', origin: 'model', sourceSegmentIds: ['s1'], uncertainty: 'medium' };

  it('shows labeled, not-verified evidence under the claimed identity only', () => {
    render(<DecisionMap facts={[identity, payee]} webEvidence={[contradiction]} />);
    expect(screen.getAllByLabelText(/public web evidence/i)).toHaveLength(1);
    expect(screen.getByText('Contradicts public listing')).toBeVisible();
    expect(screen.getByText(/not verified/i)).toBeVisible();
  });

  it('shows nothing without evidence', () => {
    render(<DecisionMap facts={[identity]} />);
    expect(screen.queryByLabelText(/public web evidence/i)).toBeNull();
  });
});
