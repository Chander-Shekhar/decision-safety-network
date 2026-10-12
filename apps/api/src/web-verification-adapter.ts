// Swappable open-web claim-verification adapter (DSN-026 / DSN-031), mirroring
// `screening-adapter.ts`. Its return is treated as UNTRUSTED and normalized by
// `web-verification.ts`; nothing it returns is passed through.
//
// INSTITUTION CONFIG SPLIT (DSN-031, founder direction "hardcode the policy,
// not the whole flow"): the curated table carries two kinds of institution.
//  - `fictional` (Demo Bank, Demo Revenue Service) have no real web presence,
//    so their published-contact *policy* is a hardcoded synthetic pattern. This
//    is the ONLY thing that stays hardcoded; it keeps evals/injection tests and
//    the Cup demo reproducible.
//  - `real` carry an `officialDomain` and NO hardcoded pattern: their verdict is
//    derived live from that official source via `OfficialSourceGrounding`.
//
// Two adapters satisfy the same `WebVerificationAdapter` interface:
//  - `createCuratedWebVerificationAdapter()` - deterministic default (ships in
//    the Cup build); resolves fictional institutions by pattern and reports no
//    verdict for a real one (it has no live access).
//  - `createGroundedWebVerificationAdapter(grounding)` - LIVE: resolves a real
//    institution against its official domain, and still uses the hardcoded
//    pattern for a fictional one. Selected in `server.ts` by env; see 0013/0015.
//
// Injection boundary (unchanged): the hostile `claimedIdentity` only ever
// *selects* an institution from this closed table (worst case: it names a
// curated one); it is NEVER forwarded into a grounding prompt. The grounding
// port is asked only about the server-curated `displayName`/`officialDomain`
// plus the normalized number, and `web-verification.ts`'s sanitizer still drops
// everything the adapter returns except the institution key and the match enum.

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

/**
 * The narrow live boundary for a real institution's official-source number
 * check. Deliberately receives ONLY server-curated institution fields plus the
 * normalized number - never the hostile `claimedIdentity` free text - and
 * returns only a closed `NumberMatch` enum, so no grounded page text can reach
 * the verdict. Implemented live by `gemini.ts`'s
 * `createGeminiOfficialSourceGrounding()` and by a test double. May throw;
 * `verifyClaimOnWeb` degrades a throw to an inconclusive result.
 */
export interface OfficialSourceGrounding {
  checkNumber(query: { displayName: string; officialDomain: string; normalizedNumber: string }): Promise<NumberMatch>;
}

interface BaseInstitution {
  key: string;
  /** The only institution text that ever reaches output. */
  displayName: string;
  aliases: readonly string[];
}

/** A fictional institution with a hardcoded synthetic listed-number pattern (no real web presence). */
export interface FictionalInstitution extends BaseInstitution {
  kind: 'fictional';
  /** Publicly listed contact pattern over normalized E.164-style numbers. Synthetic. */
  numberPattern: RegExp;
}

/** A real-shaped institution whose verdict is derived live from its official source; carries no hardcoded pattern. */
export interface RealInstitution extends BaseInstitution {
  kind: 'real';
  /** The authoritative source the grounded lookup is constrained to (an attacker cannot replace a real institution's own official site). */
  officialDomain: string;
}

export type CuratedInstitution = FictionalInstitution | RealInstitution;

/**
 * The server's closed institution table. Demo Bank / Demo Revenue Service are
 * fictional with synthetic hardcoded patterns; `demo-national-bank` is a
 * clearly-fictional (`.example`) stand-in for a REAL bank config - it carries
 * no pattern and is resolved only via the grounded adapter against its official
 * domain. No real institution is named, listed, or contacted (synthetic data
 * only).
 */
export const CURATED_INSTITUTIONS: readonly CuratedInstitution[] = [
  { kind: 'fictional', key: 'demo-bank', displayName: 'Demo Bank', aliases: ['demo bank'], numberPattern: /^\+91(1800|1860)\d{6}$/ },
  { kind: 'fictional', key: 'demo-revenue-service', displayName: 'Demo Revenue Service', aliases: ['demo revenue service', 'demo revenue'], numberPattern: /^\+911800\d{6}$/ },
  { kind: 'real', key: 'demo-national-bank', displayName: 'Demo National Bank', aliases: ['demo national bank'], officialDomain: 'verify.demo-national-bank.example' },
];

export function institutionByKey(key: unknown): CuratedInstitution | undefined {
  return CURATED_INSTITUTIONS.find((i) => i.key === key);
}

/** Resolves the single curated institution a claimed identity names, or `undefined` when it names zero or several (closed list; hostile text can at most pick one of these). */
function resolveInstitution(claimedIdentity: string): CuratedInstitution | undefined {
  const text = claimedIdentity.toLowerCase().replace(/\s+/g, ' ');
  const hits = CURATED_INSTITUTIONS.filter((i) => i.aliases.some((a) => text.includes(a)));
  return hits.length === 1 ? hits[0] : undefined;
}

/** The hardcoded-pattern verdict for a fictional institution; a real one has no offline verdict. */
function fictionalMatch(institution: CuratedInstitution, normalizedNumber: string): NumberMatch {
  return institution.kind === 'fictional' ? (institution.numberPattern.test(normalizedNumber) ? 'matches-pattern' : 'mismatch') : 'unknown';
}

/**
 * Deterministic curated provider (Cup default). Fictional institutions resolve
 * by their hardcoded pattern; a real institution is recognized but yields no
 * verdict here (it needs the live official source - use the grounded adapter).
 * Ambiguous or unrecognized identities yield no institution.
 */
export function createCuratedWebVerificationAdapter(): WebVerificationAdapter {
  return {
    async lookup({ claimedIdentity, normalizedNumber }) {
      const institution = resolveInstitution(claimedIdentity);
      if (!institution) return { source: 'curated-sample', numberMatch: 'unknown' };
      return { source: 'curated-sample', institutionKey: institution.key, numberMatch: fictionalMatch(institution, normalizedNumber) };
    },
  };
}

/**
 * Live provider (DSN-031): a real institution's number is checked against its
 * own official source via `grounding`; a fictional institution keeps using its
 * hardcoded pattern ("hardcode the policy, not the flow"). The hostile
 * `claimedIdentity` only selects the (closed-table) institution and is never
 * forwarded to `grounding` - only the curated `displayName`/`officialDomain`
 * and the normalized number are. The return is still fully re-normalized by
 * the sanitizer downstream.
 */
export function createGroundedWebVerificationAdapter(grounding: OfficialSourceGrounding): WebVerificationAdapter {
  return {
    async lookup({ claimedIdentity, normalizedNumber }) {
      const institution = resolveInstitution(claimedIdentity);
      if (!institution) return { source: 'grounded-web', numberMatch: 'unknown' };
      if (institution.kind === 'fictional') {
        return { source: 'curated-sample', institutionKey: institution.key, numberMatch: fictionalMatch(institution, normalizedNumber) };
      }
      const numberMatch = await grounding.checkNumber({
        displayName: institution.displayName,
        officialDomain: institution.officialDomain,
        normalizedNumber,
      });
      return { source: 'grounded-web', institutionKey: institution.key, numberMatch };
    },
  };
}
