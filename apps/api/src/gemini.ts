import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import {
  REQUIRED_FACT_FIELDS,
  type CandidateFact,
  type CandidateRelation,
  type FactSegmentInput,
  type GeminiPort,
  type RelateInput,
} from '../../../packages/contracts/src/facts.js';

/**
 * Prompt/schema version for `extract`. Bump whenever the prompt or response
 * schema changes, so a `Fact.modelVersion` always identifies exactly which
 * extraction logic produced a given value.
 */
export const EXTRACT_PROMPT_VERSION = 'facts-extract-v1';

/** Prompt/schema version for `relate`. See `EXTRACT_PROMPT_VERSION`. */
export const RELATE_PROMPT_VERSION = 'facts-relate-v1';

const UncertaintySchema = z.enum(['low', 'medium', 'high']);

const CandidateFactSchema = z.object({
  field: z.string(),
  value: z.string(),
  sourceSegmentIds: z.array(z.string()),
  uncertainty: UncertaintySchema,
});

const CandidateFactsResponseSchema = z.object({ facts: z.array(CandidateFactSchema) });

const RelationFieldMatchSchema = z.object({
  field: z.enum(['amountMinor', 'beneficiaryId']),
  matches: z.boolean(),
  sourceSegmentIds: z.array(z.string()),
});

const CandidateRelationResponseSchema = z.object({
  segmentIds: z.array(z.string()),
  draftEventId: z.string(),
  draftVersion: z.number().int(),
  inputCaseVersion: z.number().int(),
  directedAction: z.boolean(),
  matches: z.array(RelationFieldMatchSchema),
});

/**
 * Hand-written JSON Schema mirrors of the Zod schemas above, for Gemini's
 * `responseJsonSchema` config - the SDK takes a plain JSON Schema object,
 * not a Zod schema, so these cannot be derived automatically. Zod still
 * re-validates every response below rather than trusting the model's
 * adherence to this constraint.
 */
const candidateFactsJsonSchema = {
  type: 'object',
  properties: {
    facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          value: { type: 'string' },
          sourceSegmentIds: { type: 'array', items: { type: 'string' } },
          uncertainty: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['field', 'value', 'sourceSegmentIds', 'uncertainty'],
      },
    },
  },
  required: ['facts'],
} as const;

const relationJsonSchema = {
  type: 'object',
  properties: {
    segmentIds: { type: 'array', items: { type: 'string' } },
    draftEventId: { type: 'string' },
    draftVersion: { type: 'number' },
    inputCaseVersion: { type: 'number' },
    directedAction: { type: 'boolean' },
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string', enum: ['amountMinor', 'beneficiaryId'] },
          matches: { type: 'boolean' },
          sourceSegmentIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['field', 'matches', 'sourceSegmentIds'],
      },
    },
  },
  required: ['segmentIds', 'draftEventId', 'draftVersion', 'inputCaseVersion', 'directedAction', 'matches'],
} as const;

function modelId(): string {
  return process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
}

/**
 * Concrete `GeminiPort` adapter over `@google/genai` (Vertex AI mode, Google
 * Cloud service identity - no API key handled by this process). Segments
 * are sent as structured prompt content (the `segments` field of a JSON
 * request body) rather than concatenated into free-form instruction text,
 * but that framing alone does not prove hostile transcript text can never
 * sway the model (PRD C12 is a defense-in-depth posture, not a guarantee
 * about model behavior). The actual safety boundary is downstream of this
 * adapter: `temperature: 0` plus a `responseJsonSchema` constrain the
 * response shape, `fact-validator.ts`'s Zod re-validation (never trusting
 * the SDK's own enforcement) drops anything malformed or fabricated, and -
 * most importantly - a `CandidateFact` can never become trusted or
 * consequential state on its own; only the owner's explicit
 * `correctFact`/`confirmFact` promotes a value into `confirmed`. So even a
 * successful injection can at most produce a wrong *displayed, model-origin*
 * claim, never a trusted fact, an action, or a field beyond what `facts.ts`
 * declares - in particular, no scam-probability or mental-state field
 * exists anywhere in these schemas, and this module never selects an
 * action.
 *
 * Not exercised against the real Google Cloud endpoint by any test in this
 * task: `apps/api/test/facts.test.ts` uses an inline fake `GeminiPort`
 * instead. Live calls are gated to DSN-014 (cloud auth/deployment).
 */
export function createGeminiPort(): GeminiPort {
  const ai = new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT ?? '', location: 'global' });

  return {
    async extract(segments: FactSegmentInput[]): Promise<CandidateFact[]> {
      const response = await ai.models.generateContent({
        model: modelId(),
        contents: JSON.stringify({
          task: 'extract source-grounded case facts',
          promptVersion: EXTRACT_PROMPT_VERSION,
          requiredFields: REQUIRED_FACT_FIELDS,
          segments,
        }),
        config: { responseMimeType: 'application/json', responseJsonSchema: candidateFactsJsonSchema, temperature: 0 },
      });
      const parsed = CandidateFactsResponseSchema.parse(JSON.parse(response.text ?? '{}'));
      return parsed.facts;
    },

    async relate(input: RelateInput): Promise<CandidateRelation> {
      const response = await ai.models.generateContent({
        model: modelId(),
        contents: JSON.stringify({
          task: 'relate caller-requested action to proposed payment',
          promptVersion: RELATE_PROMPT_VERSION,
          segments: input.segments,
          draftEventId: input.draftEventId,
          draftVersion: input.draftVersion,
          inputCaseVersion: input.inputCaseVersion,
          amountMinor: input.amountMinor,
          beneficiaryId: input.beneficiaryId,
        }),
        config: { responseMimeType: 'application/json', responseJsonSchema: relationJsonSchema, temperature: 0 },
      });
      const relation = CandidateRelationResponseSchema.parse(JSON.parse(response.text ?? '{}'));
      if (
        relation.draftEventId !== input.draftEventId ||
        relation.draftVersion !== input.draftVersion ||
        relation.inputCaseVersion !== input.inputCaseVersion
      ) {
        throw new Error('STALE_RELATION');
      }
      return relation;
    },
  };
}
