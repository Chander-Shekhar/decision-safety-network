// Fictional, versioned Demo Bank registry (plan Task 8 / DSN-010; PRD C7,
// "Institutions"). This is the ONLY actionable verification route this
// prototype ever calls - a caller-supplied phone number, callback, URL, or
// route is never read, let alone dialed/fetched, by `verification.ts`.
// `DEMO_BANK_REGISTRY` is intentionally a fixed literal, not model-generated
// or derived from any request: PRD 7.3/8.2 forbid a caller's transcript from
// ever supplying the route a safety-critical check depends on.
//
// Demo Bank is clearly fictional and carries no real-bank branding
// (wireframe frame 04's "FICTIONAL DEMO BANK"). `reviewedAt` is this
// registry record's own last-reviewed date, mirroring the wireframe guide's
// "curated, versioned records with source and last-reviewed date" rule
// (PRD §7/§8 prohibitions) - not a claim that any live institution was
// contacted.

/** The one fictional institution this prototype's verification route may ever name. */
export interface DemoBankRegistry {
  id: 'demo-bank';
  /** Bumped on any change to this record; written back onto every `VerificationResult` as `registryVersion`. */
  version: string;
  /** Always `true` - asserted in the type, not just at a value, so no caller of this module can mistake it for a real institution record. */
  fictional: true;
  routeLabel: string;
  source: string;
  reviewedAt: string;
}

export const DEMO_BANK_REGISTRY: DemoBankRegistry = {
  id: 'demo-bank',
  version: 'cup-1',
  fictional: true,
  routeLabel: 'Demo Bank verification (simulated)',
  source: 'local fictional registry',
  reviewedAt: '2026-10-02',
};
