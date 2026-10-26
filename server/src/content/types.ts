/**
 * Content model. The question types below mirror `.claude/state/spec.md`
 * ("Question model" / "Client-safe question"). Everything after the
 * "Supporting types" marker is additional plumbing used by the registry,
 * grader and presenter.
 */

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type FigureSpec =
  | { type: 'pole_zero'; poles: { re: number; im: number }[]; zeros: { re: number; im: number }[] }
  | {
      type: 'step_response';
      points: [number, number][];
      finalValue?: number;
      xLabel?: string;
      yLabel?: string;
    }
  | {
      type: 'bode_mag';
      /** [ω rad/s, dB], ω log-spaced */
      points: [number, number][];
      asymptotes?: [number, number][];
    };

export interface Base {
  id: string;
  skillId: string;
  difficulty: Difficulty;
  prompt: string;
  explanation: string;
  figure?: FigureSpec;
}

export type StaticQuestion = Base &
  (
    | { kind: 'mcq'; choices: string[]; answer: number }
    | { kind: 'true_false'; answer: boolean }
    | { kind: 'numeric'; answer: number; tolerance: { abs?: number; rel?: number }; unit?: string }
    | { kind: 'multi_select'; choices: string[]; answer: number[] }
    | {
        kind: 'match';
        left: string[];
        right: string[];
        /** left i ↔ right answer[i] */
        answer: number[];
      }
  );

/**
 * `Omit` that distributes over unions, so the discriminated union of
 * `StaticQuestion` survives (plain `Omit<StaticQuestion, 'id'>` would collapse
 * it to the keys common to every kind and reject `choices`, `left`, ...).
 */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A question without its id: what generators return and what the presenter consumes. */
export type QuestionBody = DistributiveOmit<StaticQuestion, 'id'>;

export interface Generator {
  id: string;
  skillId: string;
  difficulties: Difficulty[];
  generate(rng: () => number, d: Difficulty): QuestionBody;
}

export type QuestionKind = StaticQuestion['kind'];

export const QUESTION_KINDS: readonly QuestionKind[] = [
  'mcq',
  'true_false',
  'numeric',
  'multi_select',
  'match',
] as const;

export interface ClientQuestion {
  itemId: number;
  position: number;
  total: number;
  skillId: string;
  difficulty: Difficulty;
  kind: QuestionKind;
  prompt: string;
  figure?: FigureSpec;
  /** mcq, multi_select (server-shuffled) */
  choices?: string[];
  /** match (right side server-shuffled) */
  left?: string[];
  right?: string[];
  /** numeric */
  unit?: string;
}

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/** The part of a ClientQuestion the content layer produces; the session layer adds item/position/total. */
export type ClientQuestionBody = Omit<ClientQuestion, 'itemId' | 'position' | 'total'>;

/** Responses, with indices referring to the displayed (shuffled) order. */
export interface McqResponse {
  choice: number;
}
export interface TrueFalseResponse {
  value: boolean;
}
export interface NumericResponse {
  value: number;
}
export interface MultiSelectResponse {
  choices: number[];
}
export interface MatchResponse {
  /** pairs[i] = index into displayed `right` matched with left i */
  pairs: number[];
}
export type QuestionResponse =
  | McqResponse
  | TrueFalseResponse
  | NumericResponse
  | MultiSelectResponse
  | MatchResponse;

export interface NumericTolerance {
  abs?: number;
  rel?: number;
}

/** Answer keys, stored in display order (what `session_items.answer_key` holds). */
export type McqKey = { answer: number };
export type TrueFalseKey = { answer: boolean };
export type NumericKey = { answer: number; tolerance: NumericTolerance };
export type MultiSelectKey = { answer: number[] };
export type MatchKey = { answer: number[] };
export type AnswerKey = McqKey | TrueFalseKey | NumericKey | MultiSelectKey | MatchKey;

// Curriculum ----------------------------------------------------------------

export interface SkillDef {
  id: string;
  title: string;
}

export interface UnitDef {
  id: string;
  title: string;
  description: string;
  skills: SkillDef[];
}

export interface Skill extends SkillDef {
  unitId: string;
  /** Global path order, 0-based. */
  index: number;
}

// Content packs ---------------------------------------------------------------

/** The content of one unit file in `server/src/content/units/`. Build it with `defineUnit`. */
export interface UnitContent {
  /** Unit id from the curriculum (e.g. `'u1'`), or `'fixtures'` for test-only content. */
  unitId: string;
  items: StaticQuestion[];
  generators: Generator[];
}
