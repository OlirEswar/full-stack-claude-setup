import { getSkill } from './curriculum.ts';
import type { FigureSpec, QuestionBody, StaticQuestion } from './types.ts';

export const MAX_TEXT_LENGTH = 300;

/** Substrings that indicate LaTeX. Content must be Unicode plain text (s², ζ, ωn, √ ...). */
export const LATEX_MARKERS = ['\\', '$', '^{', '_{'] as const;

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function latexIn(text: string): string | undefined {
  return LATEX_MARKERS.find((m) => text.includes(m));
}

function checkText(errors: string[], label: string, value: unknown, opts: { required: boolean; max?: number }): void {
  if (value === undefined && !opts.required) return;
  if (typeof value !== 'string') {
    errors.push(`${label} must be a string`);
    return;
  }
  if (opts.required && value.trim().length === 0) errors.push(`${label} must not be empty`);
  if (opts.max !== undefined && value.length > opts.max) errors.push(`${label} exceeds ${opts.max} chars`);
  const marker = latexIn(value);
  if (marker) errors.push(`${label} contains LaTeX marker "${marker}"`);
}

function checkStringList(errors: string[], label: string, value: unknown, minLen: number): value is string[] {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return false;
  }
  if (value.length < minLen) errors.push(`${label} needs at least ${minLen} entries`);
  value.forEach((v, i) => checkText(errors, `${label}[${i}]`, v, { required: true, max: MAX_TEXT_LENGTH }));
  const strings = value.filter((v): v is string => typeof v === 'string').map((v) => v.trim());
  if (new Set(strings).size !== strings.length) errors.push(`${label} has duplicate entries`);
  return true;
}

function isPoint(p: unknown): p is [number, number] {
  return Array.isArray(p) && p.length === 2 && isFiniteNum(p[0]) && isFiniteNum(p[1]);
}

export function validateFigure(figure: unknown): string[] {
  const errors: string[] = [];
  if (typeof figure !== 'object' || figure === null) return ['figure must be an object'];
  const f = figure as FigureSpec;
  switch (f.type) {
    case 'pole_zero': {
      const isC = (c: unknown) =>
        typeof c === 'object' && c !== null && isFiniteNum((c as { re: unknown }).re) && isFiniteNum((c as { im: unknown }).im);
      if (!Array.isArray(f.poles) || !f.poles.every(isC)) errors.push('pole_zero.poles must be finite {re, im}[]');
      if (!Array.isArray(f.zeros) || !f.zeros.every(isC)) errors.push('pole_zero.zeros must be finite {re, im}[]');
      if (errors.length === 0 && f.poles.length + f.zeros.length === 0) errors.push('pole_zero needs at least one pole or zero');
      break;
    }
    case 'step_response': {
      if (!Array.isArray(f.points) || f.points.length < 2 || !f.points.every(isPoint)) {
        errors.push('step_response.points must be >= 2 finite [t, y] pairs');
      } else if (f.points.some((p, i) => i > 0 && p[0] < (f.points[i - 1] as [number, number])[0])) {
        errors.push('step_response.points must have non-decreasing t');
      }
      if (f.finalValue !== undefined && !isFiniteNum(f.finalValue)) errors.push('step_response.finalValue must be finite');
      checkText(errors, 'step_response.xLabel', f.xLabel, { required: false, max: 40 });
      checkText(errors, 'step_response.yLabel', f.yLabel, { required: false, max: 40 });
      break;
    }
    case 'bode_mag': {
      const okPts = (pts: unknown) =>
        Array.isArray(pts) && pts.length >= 2 && pts.every((p) => isPoint(p) && p[0] > 0) &&
        pts.every((p, i) => i === 0 || (p as [number, number])[0] > (pts[i - 1] as [number, number])[0]);
      if (!okPts(f.points)) errors.push('bode_mag.points must be >= 2 finite [ω > 0, dB] pairs with increasing ω');
      if (f.asymptotes !== undefined && !okPts(f.asymptotes)) {
        errors.push('bode_mag.asymptotes must be >= 2 finite [ω > 0, dB] pairs with increasing ω');
      }
      break;
    }
    default:
      errors.push(`unknown figure type "${(f as { type?: unknown }).type as string}"`);
  }
  return errors;
}

/**
 * Validate a static item or a generator's output. Returns a list of human-readable
 * problems; an empty list means the question is fine.
 */
export function validateQuestion(q: StaticQuestion | QuestionBody): string[] {
  const errors: string[] = [];
  const anyQ = q as unknown as Record<string, unknown>;

  if (typeof q.skillId !== 'string' || !getSkill(q.skillId)) errors.push(`unknown skillId "${String(q.skillId)}"`);
  if ('id' in anyQ) {
    const id = anyQ.id;
    if (typeof id !== 'string' || !new RegExp(`^${q.skillId}/[a-z0-9][a-z0-9-]*$`).test(id)) {
      errors.push(`id "${String(id)}" must look like "<skillId>/<slug>" (slug: lowercase, digits, dashes)`);
    }
  }
  if (![1, 2, 3, 4, 5].includes(q.difficulty)) errors.push(`difficulty must be 1..5, got ${String(q.difficulty)}`);
  checkText(errors, 'prompt', q.prompt, { required: true, max: MAX_TEXT_LENGTH });
  checkText(errors, 'explanation', q.explanation, { required: true, max: MAX_TEXT_LENGTH });
  if (q.figure !== undefined) errors.push(...validateFigure(q.figure).map((e) => `figure: ${e}`));

  switch (q.kind) {
    case 'mcq': {
      if (checkStringList(errors, 'choices', q.choices, 3)) {
        if (!isInt(q.answer) || q.answer < 0 || q.answer >= q.choices.length) errors.push('mcq answer index out of range');
      }
      break;
    }
    case 'true_false':
      if (typeof q.answer !== 'boolean') errors.push('true_false answer must be boolean');
      break;
    case 'numeric': {
      if (!isFiniteNum(q.answer)) errors.push('numeric answer must be a finite number');
      const t = q.tolerance as unknown;
      if (typeof t !== 'object' || t === null) {
        errors.push('numeric tolerance must be an object ({} uses the default rel 0.02)');
      } else {
        const { abs, rel } = t as { abs?: unknown; rel?: unknown };
        if (abs !== undefined && !(isFiniteNum(abs) && abs >= 0)) errors.push('tolerance.abs must be a finite number >= 0');
        if (rel !== undefined && !(isFiniteNum(rel) && rel >= 0)) errors.push('tolerance.rel must be a finite number >= 0');
      }
      checkText(errors, 'unit', q.unit, { required: false, max: 20 });
      break;
    }
    case 'multi_select': {
      if (checkStringList(errors, 'choices', q.choices, 3)) {
        if (!Array.isArray(q.answer) || q.answer.length === 0) {
          errors.push('multi_select answer must be a non-empty index list');
        } else {
          if (!q.answer.every((a) => isInt(a) && a >= 0 && a < q.choices.length)) {
            errors.push('multi_select answer index out of range');
          }
          if (new Set(q.answer).size !== q.answer.length) errors.push('multi_select answer has duplicates');
        }
      }
      break;
    }
    case 'match': {
      const okL = checkStringList(errors, 'left', q.left, 2);
      const okR = checkStringList(errors, 'right', q.right, 2);
      if (okL && okR) {
        if (q.left.length !== q.right.length) errors.push('match left and right must have the same length');
        const n = q.right.length;
        if (!Array.isArray(q.answer) || q.answer.length !== q.left.length) {
          errors.push('match answer must have one entry per left item');
        } else if (!q.answer.every((a) => isInt(a) && a >= 0 && a < n) || new Set(q.answer).size !== q.answer.length) {
          errors.push('match answer must be a permutation of right indices');
        }
      }
      break;
    }
    default:
      errors.push(`unknown kind "${String((q as { kind?: unknown }).kind)}"`);
  }
  return errors;
}
