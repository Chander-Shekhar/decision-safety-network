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
 * Transient model overloads (HTTP 503 "high demand", 429) are retried with
 * backoff, then fall through to the next candidate model — the Developer API
 * free tier is frequently busy, which is not a wiring failure.
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
  'gemini-2.5-flash-lite',
].filter((m): m is string => Boolean(m));

const MAX_ATTEMPTS = 4;

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const isModelNotFound = (error: unknown): boolean => /NOT_FOUND|404|not found|is not supported|was not found/i.test(message(error));
const isTransient = (error: unknown): boolean =>
  /503|UNAVAILABLE|overloaded|high demand|429|RESOURCE_EXHAUSTED|\b500\b|INTERNAL|ETIMEDOUT|ECONNRESET/i.test(message(error));
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** One full round-trip against `model`. Returns true if a source-grounded fact came back. */
async function runOnce(model: string): Promise<boolean> {
  process.env.GEMINI_MODEL = model;
  const gemini = createGeminiPort();

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

  return grounded.length > 0;
}

async function main(): Promise<void> {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_CLOUD_PROJECT) {
    console.error('No backend: set GEMINI_API_KEY (Developer API) or GOOGLE_CLOUD_PROJECT + ADC (Vertex). See docs/demo-runbook.md.');
    process.exit(1);
  }
  const backend = process.env.GEMINI_API_KEY ? 'Gemini Developer API key' : 'Vertex AI / ADC';

  let lastError: unknown;
  for (const model of MODEL_CANDIDATES) {
    console.log(`\n[smoke] backend=${backend} model=${model}`);
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const pass = await runOnce(model);
        console.log(`\n[smoke] RESULT: ${pass ? 'PASS' : 'FAIL'} — model=${model}`);
        if (pass) {
          console.log(`[smoke] Set this for the dev server:  export GEMINI_MODEL=${model}`);
        } else {
          console.log('[smoke] The call succeeded but returned no source-grounded fact; inspect the output above.');
        }
        process.exit(pass ? 0 : 2);
      } catch (error) {
        lastError = error;
        if (isModelNotFound(error)) {
          console.log(`[smoke] model "${model}" not available for this key; trying the next candidate...`);
          break;
        }
        if (isTransient(error)) {
          if (attempt < MAX_ATTEMPTS) {
            const delaySec = 2 * attempt;
            console.log(`[smoke] "${model}" transient (attempt ${attempt}/${MAX_ATTEMPTS}): ${message(error)}`);
            console.log(`[smoke] retrying in ${delaySec}s...`);
            await sleep(delaySec * 1000);
            continue;
          }
          console.log(`[smoke] "${model}" still overloaded after ${MAX_ATTEMPTS} attempts; trying the next model...`);
          break;
        }
        throw error; // genuine failure (auth, bad request, schema) — surface it
      }
    }
  }
  throw lastError ?? new Error('No model candidates to try');
}

main().catch((error: unknown) => {
  console.error(`\n[smoke] ERROR: ${message(error)}`);
  if (isModelNotFound(error)) {
    console.error('[smoke] None of the tried model ids resolved. Open AI Studio, copy a model id your key lists, and re-run with:');
    console.error('[smoke]   export GEMINI_MODEL=<that-id> && npm run smoke:llm');
  } else if (isTransient(error)) {
    console.error('[smoke] Every candidate was overloaded (free-tier capacity). This is transient — wait a minute and re-run `npm run smoke:llm`.');
  }
  process.exit(1);
});
