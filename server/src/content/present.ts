import { resolveTolerance } from './grade.ts';
import { shuffle, type Rng } from './rng.ts';
import type {
  AnswerKey,
  ClientQuestionBody,
  FigureSpec,
  MatchKey,
  McqKey,
  MultiSelectKey,
  NumericKey,
  QuestionBody,
  StaticQuestion,
  TrueFalseKey,
} from './types.ts';

export interface PresentedQuestion {
  /** Safe to send to the client: never contains the answer, tolerance or explanation. */
  client: ClientQuestionBody;
  /** Answer key remapped to the displayed order. Store it server-side only. */
  answerKey: AnswerKey;
}

function cloneFigure(f: FigureSpec): FigureSpec {
  return JSON.parse(JSON.stringify(f)) as FigureSpec;
}

/** Random permutation: display[i] = original[perm[i]]. */
function permutation(rng: Rng, n: number): number[] {
  return shuffle(
    rng,
    Array.from({ length: n }, (_, i) => i),
  );
}

/**
 * Turn a static or generated question into a client payload plus a display-order
 * answer key. Choices (mcq, multi_select) and the right column (match) are
 * shuffled with `rng`. The client object is built from an explicit whitelist of
 * fields, so nothing answer-related can leak.
 */
export function toClientQuestion(instance: StaticQuestion | QuestionBody, rng: Rng): PresentedQuestion {
  const client: ClientQuestionBody = {
    skillId: instance.skillId,
    difficulty: instance.difficulty,
    kind: instance.kind,
    prompt: instance.prompt,
  };
  if (instance.figure) client.figure = cloneFigure(instance.figure);

  switch (instance.kind) {
    case 'mcq': {
      const perm = permutation(rng, instance.choices.length);
      client.choices = perm.map((i) => instance.choices[i] as string);
      const key: McqKey = { answer: perm.indexOf(instance.answer) };
      return { client, answerKey: key };
    }
    case 'multi_select': {
      const perm = permutation(rng, instance.choices.length);
      client.choices = perm.map((i) => instance.choices[i] as string);
      const key: MultiSelectKey = { answer: instance.answer.map((a) => perm.indexOf(a)).sort((x, y) => x - y) };
      return { client, answerKey: key };
    }
    case 'match': {
      const perm = permutation(rng, instance.right.length);
      client.left = instance.left.slice();
      client.right = perm.map((i) => instance.right[i] as string);
      const key: MatchKey = { answer: instance.answer.map((a) => perm.indexOf(a)) };
      return { client, answerKey: key };
    }
    case 'true_false': {
      const key: TrueFalseKey = { answer: instance.answer };
      return { client, answerKey: key };
    }
    case 'numeric': {
      if (instance.unit) client.unit = instance.unit;
      const key: NumericKey = { answer: instance.answer, tolerance: resolveTolerance(instance.tolerance) };
      return { client, answerKey: key };
    }
  }
}

/** Format a number for display without float noise (e.g. 0.30000000000000004 → "0.3"). */
export function formatNumber(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  const rounded = Number(x.toPrecision(6));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/**
 * Human-readable correct answer for the feedback sheet, from the client payload
 * (display order) and its answer key.
 */
export function answerText(client: ClientQuestionBody, answerKey: AnswerKey): string {
  const k = answerKey as unknown as Record<string, unknown>;
  switch (client.kind) {
    case 'mcq':
      return client.choices?.[k.answer as number] ?? '';
    case 'true_false':
      return k.answer ? 'True' : 'False';
    case 'numeric': {
      const n = formatNumber(k.answer as number);
      return client.unit ? `${n} ${client.unit}` : n;
    }
    case 'multi_select':
      return (k.answer as number[]).map((i) => client.choices?.[i] ?? '').join(', ');
    case 'match':
      return (k.answer as number[]).map((r, i) => `${client.left?.[i] ?? ''} → ${client.right?.[r] ?? ''}`).join('; ');
  }
}
