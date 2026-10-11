// Swappable open-web claim-verification adapter (DSN-026), mirroring
// `screening-adapter.ts`. The Cup ships a deterministic curated
// implementation so tests and evals are reproducible. Its return is treated
// as UNTRUSTED and normalized by `web-verification.ts`; nothing it returns
// is passed through.
//
// LIVE GROUNDING SEAM: a live implementation (Google AI grounding via the
// `GeminiPort`) implements the same `WebVerificationAdapter` and is injected
// into `createWebVerificationRoutes(adapter)`. It must only be asked
// "does this number fit the public contact pattern of <curated institution
// key>?" and return `RawWebLookup`; the sanitizer drops everything but the
// institution key and match enum, so grounded page text can never reach the
// verdict. Not enabled here: tests/evals use the curated default.

export type NumberMatch = 'matches-pattern' | 'mismatch' | 'unknown';

/** What an adapter may report. Anything outside these fields is dropped by the sanitizer. */
export interface RawWebLookup {
  /** Key into the server's curated institution table. */
  institutionKey?: string;
  numberMatch?: NumberMatch;
  source?: 'curated-sample' | 'grounded-web';
}

export interface WebVerificationAdapter {
  /** `claimedIdentity` is caller/transcript-derived and hostile. May throw; callers degrade to inconclusive. */
  lookup(query: { claimedIdentity: string; normalizedNumber: string }): Promise<RawWebLookup>;
}

export interface CuratedInstitution {
  key: string;
  /** The only institution text that ever reaches output. */
  displayName: string;
  aliases: readonly string[];
  /** Publicly listed contact pattern over normalized E.164-style numbers. Synthetic. */
  numberPattern: RegExp;
}

/** Fictional institutions with synthetic listed-number patterns. */
export const CURATED_INSTITUTIONS: readonly CuratedInstitution[] = [
  { key: 'demo-bank', displayName: 'Demo Bank', aliases: ['demo bank'], numberPattern: /^\+91(1800|1860)\d{6}$/ },
  { key: 'demo-revenue-service', displayName: 'Demo Revenue Service', aliases: ['demo revenue service', 'demo revenue'], numberPattern: /^\+911800\d{6}$/ },
];

export function institutionByKey(key: unknown): CuratedInstitution | undefined {
  return CURATED_INSTITUTIONS.find((i) => i.key === key);
}

/** Deterministic curated provider. Ambiguous or unrecognized identities yield no institution. */
export function createCuratedWebVerificationAdapter(): WebVerificationAdapter {
  return {
    async lookup({ claimedIdentity, normalizedNumber }) {
      const text = claimedIdentity.toLowerCase().replace(/\s+/g, ' ');
      const hits = CURATED_INSTITUTIONS.filter((i) => i.aliases.some((a) => text.includes(a)));
      if (hits.length !== 1) return { source: 'curated-sample', numberMatch: 'unknown' };
      const hit = hits[0]!;
      return {
        source: 'curated-sample',
        institutionKey: hit.key,
        numberMatch: hit.numberPattern.test(normalizedNumber) ? 'matches-pattern' : 'mismatch',
      };
    },
  };
}
