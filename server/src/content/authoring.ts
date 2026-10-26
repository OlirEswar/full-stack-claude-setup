/**
 * Authoring helpers for content packs. Read this before writing a unit file.
 *
 * ## How to add a unit
 *
 * 1. Create `server/src/content/units/uNN-<name>.ts`:
 *
 *    ```ts
 *    import { defineGenerator, defineUnit, nice } from '../authoring.ts';
 *    import { int, pick } from '../rng.ts';
 *
 *    export default defineUnit({
 *      unitId: 'u3',                       // id from curriculum.ts
 *      items: [
 *        {
 *          id: 'first-order/tau-from-tf',   // "<skillId>/<slug>", globally unique
 *          skillId: 'first-order',
 *          difficulty: 1,
 *          kind: 'numeric',
 *          prompt: 'G(s) = 5/(2s + 1). What is the time constant τ?',
 *          answer: 2,
 *          tolerance: {},                   // {} = default rel 0.02
 *          unit: 's',
 *          explanation: 'Write it as K/(τs + 1): τ is the coefficient of s, so τ = 2 s.',
 *        },
 *      ],
 *      generators: [
 *        defineGenerator({
 *          id: 'first-order-tau',           // globally unique
 *          skillId: 'first-order',
 *          difficulties: [1, 2],
 *          generate(rng, d) {
 *            const tau = pick(rng, [0.5, 1, 2, 4]);
 *            const k = int(rng, 2, 9);
 *            return { skillId: 'first-order', difficulty: d, kind: 'numeric', ... };
 *          },
 *        }),
 *      ],
 *    });
 *    ```
 *
 * 2. Register it in `units/index.ts` by adding ONE import line and ONE array entry
 *    in your pack's reserved slot (see the comments there). Don't reorder other
 *    packs' lines; that keeps parallel merges conflict-free.
 *
 * ## Rules (enforced by `validateQuestion`)
 *
 * - Unicode plain text only: s², ζ, ωn, ∞, √, →, ≤. No LaTeX: `\`, `$`, `^{`, `_{` are rejected.
 * - prompt and explanation are non-empty and ≤ 300 chars; explanations are 1–3 sentences.
 * - mcq: ≥ 3 distinct choices, `answer` is an index. multi_select: ≥ 3 distinct choices,
 *   `answer` is a non-empty list of distinct indices. match: `left`/`right` same length,
 *   `answer[i]` = index into `right` for `left[i]` (a permutation). Author choices in any
 *   order; the server shuffles them per question.
 * - numeric: finite `answer`; `tolerance: {}` means rel 0.02, or give `{abs}` / `{rel}`.
 * - Figures: see `FigureSpec` in types.ts; points must be finite, bode ω > 0 and increasing.
 *
 * ## Generator contract
 *
 * - `generate(rng, d)` must be a pure function of the rng stream and `d`. Use only `rng`
 *   (via `int`, `pick`, `shuffle`, `chance` from rng.ts), never Math.random or Date, so a
 *   stored seed reproduces the exact question.
 * - Return a question for `skillId` (same as the generator's) with `difficulty: d`.
 * - Only use difficulties listed in `difficulties`.
 * - Pick "nice" numbers: answers should be computable in ≤ 60 s with simple arithmetic.
 *   Format numbers in prompts with `nice()` to avoid float noise like 0.30000000000000004.
 * - Every output must pass `validateQuestion`, and grading its own answer must be correct
 *   (pack tests check this for 200 seeds).
 */
import type { Difficulty, Generator, QuestionBody, UnitContent } from './types.ts';

/** Identity helper that type-checks a unit's content. Export its result as the module default. */
export function defineUnit(unit: UnitContent): UnitContent {
  return unit;
}

/**
 * Identity helper that type-checks a generator. The returned generator stamps
 * `skillId` and `difficulty` onto whatever `generate` returns, so they can't drift.
 */
export function defineGenerator(gen: Generator): Generator {
  return {
    ...gen,
    generate(rng: () => number, d: Difficulty): QuestionBody {
      return { ...gen.generate(rng, d), skillId: gen.skillId, difficulty: d };
    },
  };
}

/** Round to `dp` decimal places, returning a number. */
export function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

/** Format a number for prompts/choices: rounded to `dp` places, no trailing zeros, no float noise, "−" for negatives. */
export function nice(x: number, dp = 3): string {
  const r = round(x, dp);
  const s = String(Object.is(r, -0) ? 0 : r);
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
}
