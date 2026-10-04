import type {
  CandidateFact,
  CandidateRelation,
  FactSegmentInput,
  GeminiPort,
  RelateInput,
} from '../../../packages/contracts/src/facts.js';

/**
 * Deterministic, in-memory `GeminiPort` test double for emulator-backed
 * contract tests and the local e2e journey (plan Task 12). It is the ONLY
 * Gemini a test may inject. It lives under `test/` and is never imported by
 * production code; `server.ts` refuses to boot in production with it.
 *
 * It reads only the segment text it is given (synthetic attack/legitimate
 * fixtures) and cites real segment ids, so `fact-validator.ts` keeps every
 * fact it returns. It never emits a scam probability or mental-state label.
 */
function firstSegmentMatching(segments: FactSegmentInput[], pattern: RegExp): FactSegmentInput | undefined {
  return segments.find((segment) => pattern.test(segment.text));
}

export function createFakeGemini(): GeminiPort & { readonly isTestDouble: true } {
  return {
    isTestDouble: true,
    async extract(segments: FactSegmentInput[]): Promise<CandidateFact[]> {
      const facts: CandidateFact[] = [];
      const caller = firstSegmentMatching(segments, /demo bank fraud team/i);
      if (caller) {
        facts.push({
          field: 'claimedIdentity',
          value: 'Demo Bank fraud team',
          sourceSegmentIds: [caller.id],
          uncertainty: 'low',
        });
      }
      const claim = firstSegmentMatching(segments, /account (is )?compromised/i);
      if (claim) {
        facts.push({
          field: 'centralClaim',
          value: 'Account compromised',
          sourceSegmentIds: [claim.id],
          uncertainty: 'low',
        });
      }
      const payee = firstSegmentMatching(segments, /safe-new/i);
      if (payee) {
        facts.push({ field: 'payee', value: 'safe-new', sourceSegmentIds: [payee.id], uncertainty: 'low' });
      }
      const amount = firstSegmentMatching(segments, /50,?000/);
      if (amount) {
        facts.push({ field: 'amount', value: '5000000', sourceSegmentIds: [amount.id], uncertainty: 'low' });
      }
      return facts;
    },

    async relate(input: RelateInput): Promise<CandidateRelation> {
      const directing = input.segments.filter((segment) => /safe-new|50,?000/i.test(segment.text));
      const payeeMatch = input.segments.filter((segment) => segment.text.includes(input.beneficiaryId));
      const amountText = String(input.amountMinor / 100);
      const amountGrouped = Number(amountText).toLocaleString('en-IN');
      const amountMatch = input.segments.filter(
        (segment) => segment.text.includes(amountText) || segment.text.includes(amountGrouped),
      );
      return {
        segmentIds: directing.map((segment) => segment.id),
        draftEventId: input.draftEventId,
        draftVersion: input.draftVersion,
        inputCaseVersion: input.inputCaseVersion,
        directedAction: payeeMatch.length > 0 && amountMatch.length > 0,
        matches: [
          { field: 'beneficiaryId', matches: payeeMatch.length > 0, sourceSegmentIds: payeeMatch.map((s) => s.id) },
          { field: 'amountMinor', matches: amountMatch.length > 0, sourceSegmentIds: amountMatch.map((s) => s.id) },
        ],
      };
    },
  };
}
