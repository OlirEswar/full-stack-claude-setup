import type { AnswerKey, NumericTolerance, QuestionKind, QuestionResponse } from './types.ts';

/** Tolerance used when a numeric item specifies neither `abs` nor `rel`. */
export const DEFAULT_NUMERIC_TOLERANCE: Readonly<NumericTolerance> = { rel: 0.02 };

/** Fill in the default when a tolerance specifies neither abs nor rel. */
export function resolveTolerance(tolerance: NumericTolerance | undefined): NumericTolerance {
  const t: NumericTolerance = {};
  if (tolerance && typeof tolerance.abs === 'number') t.abs = tolerance.abs;
  if (tolerance && typeof tolerance.rel === 'number') t.rel = tolerance.rel;
  return t.abs === undefined && t.rel === undefined ? { ...DEFAULT_NUMERIC_TOLERANCE } : t;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isIntArray = (v: unknown): v is number[] => Array.isArray(v) && v.every(isInt);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Shape check for a client response (use it to answer 400 on malformed bodies).
 * mcq `{choice}`, true_false `{value:boolean}`, numeric `{value:number}`,
 * multi_select `{choices:number[]}`, match `{pairs:number[]}`.
 */
export function isValidResponse(kind: QuestionKind, response: unknown): response is QuestionResponse {
  if (!isObj(response)) return false;
  switch (kind) {
    case 'mcq':
      return isInt(response.choice);
    case 'true_false':
      return typeof response.value === 'boolean';
    case 'numeric':
      return typeof response.value === 'number' && Number.isFinite(response.value);
    case 'multi_select':
      return isIntArray(response.choices);
    case 'match':
      return isIntArray(response.pairs);
    default:
      return false;
  }
}

/** Is `value` within tolerance of `answer`? abs and rel are alternatives: either one passing is enough. */
export function numericMatches(answer: number, value: number, tolerance?: NumericTolerance): boolean {
  if (!Number.isFinite(answer) || !Number.isFinite(value)) return false;
  const t = resolveTolerance(tolerance);
  const allowed = Math.max(t.abs ?? 0, (t.rel ?? 0) * Math.abs(answer));
  // Small epsilon so boundary values aren't lost to floating-point noise.
  return Math.abs(value - answer) <= allowed + 1e-9 * Math.max(1, Math.abs(answer));
}

/**
 * Grade a response against an answer key stored in display order.
 * Malformed responses or keys grade as incorrect (never throw).
 */
export function grade(kind: QuestionKind, answerKey: AnswerKey, response: unknown): boolean {
  if (!isValidResponse(kind, response) || !isObj(answerKey)) return false;
  const key = answerKey as Record<string, unknown>;
  const r = response as unknown as Record<string, unknown>;
  switch (kind) {
    case 'mcq':
      return isInt(key.answer) && r.choice === key.answer;
    case 'true_false':
      return typeof key.answer === 'boolean' && r.value === key.answer;
    case 'numeric':
      return (
        typeof key.answer === 'number' &&
        numericMatches(key.answer, r.value as number, isObj(key.tolerance) ? (key.tolerance as NumericTolerance) : undefined)
      );
    case 'multi_select': {
      if (!isIntArray(key.answer)) return false;
      const want = new Set(key.answer);
      const got = new Set(r.choices as number[]);
      if (got.size !== (r.choices as number[]).length) return false; // duplicates
      if (got.size !== want.size) return false;
      for (const c of got) if (!want.has(c)) return false;
      return true;
    }
    case 'match': {
      if (!isIntArray(key.answer)) return false;
      const pairs = r.pairs as number[];
      return pairs.length === key.answer.length && pairs.every((p, i) => p === (key.answer as number[])[i]);
    }
    default:
      return false;
  }
}
