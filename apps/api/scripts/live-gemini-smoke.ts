/**
 * Live Gemini smoke (DSN-039). Drives the REAL `gemini.ts` adapter against the
 * synthetic attack fixture and prints the structured result, so you can confirm
 * the live model works through our exact code path before the full UI journey.
 *
 * It needs a backend in the environment (same selection as `dev:api:live`):
 *   GEMINI_API_KEY=...            # Gemini Developer API (no GCP project)
 *   # or GOOGLE_CLOUD_PROJECT=... + ADC for Vertex AI
 * Optional: GEMINI_MODEL=<id the backend exposes>. If unset, a few common
 * Developer-API flash ids are tried until one resolves.
 *
 * Run (in the terminal where the key is exported): `npm run smoke:llm`.
 * It makes a real, billable model call. It never prints or persists the key.
 * No emulator, no Firestore, no Auth — just the model round-trip.
 */
import { createGeminiPort } from '../src/gemini.js';
import type { FactSegmentInput } from '../../../packages/contracts/src/facts.js';

const SEGMENTS: FactSegmentInput[] = [
  { id: 's1', speaker: 'caller', text: 'Hello, this is the Demo Bank fraud team calling about your account.' },
  { id: 's2', speaker: 'caller', text: 'Your account is compromised. We detected unauthorised access.' },
  { id: 's3', speaker: 'caller', text: 'To keep your money safe you must move it now to a safe account.' },
  { id: 's4', speaker: 'caller', text: 'Transfer 50,000 to the payee named safe-new immediately.' },
  { id: 'you1', speaker: 'you', text: 'Okay, I will send 50,000 to safe-new.' },
];

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
].filter((m): m is string => Boolean(m));

function isModelNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /NOT_FOUND|404|not found|is not supported|was not found/i.test(message);
}

async function main(): Promise<void> {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_CLOUD_PROJECT) {
    console.error('No backend: set GEMINI_API_KEY (Developer API) or GOOGLE_CLOUD_PROJECT + ADC (Vertex). See docs/demo-runbook.md.');
    process.exit(1);
  }
  const backend = process.env.GEMINI_API_KEY ? 'Gemini Developer API key' : 'Vertex AI / ADC';

  let lastError: unknown;
  for (const model of MODEL_CANDIDATES) {
    process.env.GEMINI_MODEL = model;
    const gemini = createGeminiPort();
    try {
      console.log(`\n[smoke] backend=${backend} model=${model}`);
      console.log('[smoke] calling extract()...');
      const facts = await gemini.extract(SEGMENTS);

      const segmentIds = new Set(SEGMENTS.map((s) => s.id));
      const grounded = facts.filter(
        (f) => f.value.trim().length > 0 && f.sourceSegmentIds.length > 0 && f.sourceSegmentIds.every((id) => segmentIds.has(id)),
      );
      console.log(`[smoke] extract returned ${facts.length} fact(s), ${grounded.length} well-formed + source-grounded:`);
      for (const f of facts) {
        console.log(`   - ${f.field} = ${JSON.stringify(f.value)}  (uncertainty=${f.uncertainty}, sources=[${f.sourceSegmentIds.join(',')}])`);
      }

      console.log('[smoke] calling relate()...');
      const relation = await gemini.relate({
        segments: SEGMENTS,
        draftEventId: 'evt-smoke-1',
        draftVersion: 1,
        inputCaseVersion: 1,
        amountMinor: 5_000_000,
        beneficiaryId: 'safe-new',
      });
      console.log(`[smoke] relate: directedAction=${relation.directedAction}, matches=${JSON.stringify(relation.matches)}`);

      const pass = grounded.length > 0; // live round-trip + schema + grounding plumbing all worked
      console.log(`\n[smoke] RESULT: ${pass ? 'PASS' : 'FAIL'} — model=${model}`);
      if (pass) {
        console.log(`[smoke] Set this for the dev server:  export GEMINI_MODEL=${model}`);
      } else {
        console.log('[smoke] The call succeeded but returned no source-grounded fact; inspect the output above.');
      }
      process.exit(pass ? 0 : 2);
    } catch (error) {
      lastError = error;
      if (isModelNotFound(error) && MODEL_CANDIDATES.indexOf(model) < MODEL_CANDIDATES.length - 1) {
        console.log(`[smoke] model "${model}" not available for this key; trying the next candidate...`);
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error('No model candidates to try');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[smoke] ERROR: ${message}`);
  if (isModelNotFound(error)) {
    console.error('[smoke] None of the tried model ids resolved. Open AI Studio, copy a model id your key lists, and re-run with:');
    console.error('[smoke]   export GEMINI_MODEL=<that-id> && npm run smoke:llm');
  }
  process.exit(1);
});
