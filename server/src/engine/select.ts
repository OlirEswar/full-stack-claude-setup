/**
 * Question selection (spec "Adaptive engine" → Selection / Daily selection).
 *
 * Everything here is pure given its `SelectionContext`: the registry, the
 * user's per-skill progress, the static ids they answered recently, a clock
 * and an rng are all injected.
 *
 * Selection returns descriptors, not instantiated questions. Generator picks
 * carry a fresh `seed` drawn from the rng, so `instantiate()` (or the session
 * layer) produces new numbers every time while staying reproducible.
 */
import { SKILLS } from '../content/curriculum.ts';
import type { ContentRegistry } from '../content/registry.ts';
import { chance, mulberry32, pick, randomSeed, type Rng } from '../content/rng.ts';
import type { Difficulty, Generator, QuestionBody, StaticQuestion } from '../content/types.ts';
import { pickDifficulty } from './ability.ts';
import { isDue, toMs, type TimeLike } from './spaced.ts';

/** Static items the user answered within this many days are avoided. */
export const RECENT_WINDOW_DAYS = 3;
/** Probability of choosing a generator when both a generator and a static item fit. */
export const GENERATOR_PREFERENCE = 0.4;
export const DAILY_SIZE = 5;
export const PRACTICE_SIZE = 8;
/** Daily/practice draw from at most this many due skills. */
export const MAX_DUE_SKILLS = 3;
/** Total skills a daily/practice session is spread over (due first, then weakest). */
export const MAX_REVIEW_SKILLS = 3;

/** The subset of a `skill_progress` row the engine needs. */
export interface SkillState {
  ability: number;
  attempts: number;
  level?: number;
  halfLifeDays?: number;
  lastPracticedAt?: TimeLike | null;
  nextDueAt?: TimeLike | null;
}

export interface SelectionContext {
  registry: ContentRegistry;
  /** skillId → progress. Missing skills are unstarted (θ = 0, attempts = 0). */
  progress: ReadonlyMap<string, SkillState>;
  /** Static item ids the user answered in the last RECENT_WINDOW_DAYS days. */
  recentStaticIds?: ReadonlySet<string>;
  rng: Rng;
  /** Defaults to Date.now(). */
  now?: TimeLike;
}

export type SelectedQuestion =
  | {
      source: 'static';
      /** Static item id, used as `question_ref`. */
      ref: string;
      skillId: string;
      difficulty: Difficulty;
      item: StaticQuestion;
    }
  | {
      source: 'generator';
      /** `gen:<generatorId>`, used as `question_ref`. */
      ref: string;
      skillId: string;
      difficulty: Difficulty;
      generator: Generator;
      /** Seed for `generator.generate(mulberry32(seed), difficulty)`. */
      seed: number;
    };

/** Turn a selection into a concrete question body (generators run with their seed). */
export function instantiate(sel: SelectedQuestion): QuestionBody {
  if (sel.source === 'generator') return sel.generator.generate(mulberry32(sel.seed), sel.difficulty);
  const { id: _id, ...body } = sel.item;
  return body as QuestionBody;
}

/** Difficulties for which the skill has at least one static item or generator. */
export function availableDifficulties(registry: ContentRegistry, skillId: string): Difficulty[] {
  const ds = new Set<Difficulty>();
  for (const q of registry.staticItemsFor(skillId)) ds.add(q.difficulty);
  for (const g of registry.generatorsFor(skillId)) for (const d of g.difficulties) ds.add(d);
  return [...ds].sort((a, b) => a - b);
}

export function hasContent(registry: ContentRegistry, skillId: string): boolean {
  return availableDifficulties(registry, skillId).length > 0;
}

/** Skill i is unlocked if i = 0 or skill i−1 has level ≥ 1. */
export function isSkillUnlocked(progress: ReadonlyMap<string, SkillState>, skillId: string): boolean {
  const idx = SKILLS.findIndex((s) => s.id === skillId);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const prev = SKILLS[idx - 1];
  return (progress.get(prev?.id ?? '')?.level ?? 0) >= 1;
}

/** Difficulties in fallback order: d, d−1, d+1, d−2, d+2, … restricted to `available`. */
function fallbackOrder(d: Difficulty, available: readonly Difficulty[]): Difficulty[] {
  return [...available].sort((a, b) => {
    const da = Math.abs(a - d);
    const db = Math.abs(b - d);
    return da !== db ? da - db : a - b;
  });
}

/**
 * Pick `count` questions for one skill at `pickDifficulty(θ)`.
 *
 * Rules, in order of precedence:
 * - Static items already used in this session (`used`) are never repeated
 *   while any alternative exists.
 * - Static items in `ctx.recentStaticIds` are skipped at every difficulty
 *   before being allowed back in ("when the pool allows").
 * - The target difficulty is tried first, then d±1, then further out.
 * - When a generator and a static item both fit, the generator wins ~40% of
 *   the time. Generators can be reused (fresh seed each time), but unused
 *   generators are preferred.
 *
 * `used` (static ids and `gen:` refs) is updated in place so several calls can
 * share one session.
 */
export function selectQuestionsForSkill(
  ctx: SelectionContext,
  skillId: string,
  count: number,
  used: Set<string> = new Set(),
): SelectedQuestion[] {
  const available = availableDifficulties(ctx.registry, skillId);
  if (available.length === 0 || count <= 0) return [];
  const theta = ctx.progress.get(skillId)?.ability ?? 0;
  const target = pickDifficulty(theta, available);
  const order = fallbackOrder(target, available);
  const recent = ctx.recentStaticIds ?? new Set<string>();

  const out: SelectedQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const sel = pickOne(ctx, skillId, order, used, recent);
    if (!sel) break;
    used.add(sel.ref);
    out.push(sel);
  }
  return out;
}

function pickOne(
  ctx: SelectionContext,
  skillId: string,
  order: readonly Difficulty[],
  used: ReadonlySet<string>,
  recent: ReadonlySet<string>,
): SelectedQuestion | undefined {
  const { registry, rng } = ctx;
  const tiers: ((q: StaticQuestion) => boolean)[] = [
    (q) => !used.has(q.id) && !recent.has(q.id),
    (q) => !used.has(q.id),
  ];

  for (const allowStatic of tiers) {
    for (const d of order) {
      const statics = registry.staticItemsFor(skillId, d).filter(allowStatic);
      const gens = registry.generatorsFor(skillId, d);
      const sel = choose(rng, skillId, d, statics, gens, used);
      if (sel) return sel;
    }
  }
  // Last resort: the pool is exhausted, so repeat a static item at the closest difficulty.
  for (const d of order) {
    const statics = registry.staticItemsFor(skillId, d);
    if (statics.length > 0) return staticSel(skillId, d, pick(rng, statics));
  }
  return undefined;
}

function choose(
  rng: Rng,
  skillId: string,
  d: Difficulty,
  statics: StaticQuestion[],
  gens: Generator[],
  used: ReadonlySet<string>,
): SelectedQuestion | undefined {
  if (statics.length === 0 && gens.length === 0) return undefined;
  const useGen = gens.length > 0 && (statics.length === 0 || chance(rng, GENERATOR_PREFERENCE));
  if (useGen) {
    const fresh = gens.filter((g) => !used.has(genRef(g)));
    const g = pick(rng, fresh.length > 0 ? fresh : gens);
    return { source: 'generator', ref: genRef(g), skillId, difficulty: d, generator: g, seed: randomSeed(rng) };
  }
  return staticSel(skillId, d, pick(rng, statics));
}

function staticSel(skillId: string, d: Difficulty, item: StaticQuestion): SelectedQuestion {
  return { source: 'static', ref: item.id, skillId, difficulty: d, item };
}

function genRef(g: Generator): string {
  return `gen:${g.id}`;
}

// ---------------------------------------------------------------------------
// Review sessions (daily challenge, practice)
// ---------------------------------------------------------------------------

/** Started skills with content that are due, most overdue first. */
export function dueSkills(ctx: SelectionContext): string[] {
  const now = ctx.now ?? Date.now();
  const due: { id: string; at: number }[] = [];
  for (const [id, p] of ctx.progress) {
    if (!hasContent(ctx.registry, id) || !isDue(p, now)) continue;
    due.push({ id, at: p.nextDueAt == null ? -Infinity : toMs(p.nextDueAt) });
  }
  return due.sort((a, b) => a.at - b.at || pathIndex(a.id) - pathIndex(b.id)).map((s) => s.id);
}

/** Started skills with content, ascending θ (ties in path order). */
export function weakSkills(ctx: SelectionContext): string[] {
  const started: { id: string; theta: number }[] = [];
  for (const [id, p] of ctx.progress) {
    if (p.attempts > 0 && hasContent(ctx.registry, id)) started.push({ id, theta: p.ability });
  }
  return started.sort((a, b) => a.theta - b.theta || pathIndex(a.id) - pathIndex(b.id)).map((s) => s.id);
}

/**
 * Skills for a review session: up to 3 due skills (most overdue first), then
 * the weakest started skills, up to MAX_REVIEW_SKILLS total. A user with no
 * started skills gets the first unlocked skill that has content.
 */
export function reviewSkills(ctx: SelectionContext): string[] {
  const chosen = dueSkills(ctx).slice(0, MAX_DUE_SKILLS);
  for (const id of weakSkills(ctx)) {
    if (chosen.length >= MAX_REVIEW_SKILLS) break;
    if (!chosen.includes(id)) chosen.push(id);
  }
  if (chosen.length === 0) {
    const first = SKILLS.find((s) => isSkillUnlocked(ctx.progress, s.id) && hasContent(ctx.registry, s.id));
    if (first) chosen.push(first.id);
  }
  return chosen;
}

/**
 * Spread `count` questions over the review skills (earlier skills get the
 * remainder), each at that skill's `pickDifficulty(θ)`. Questions are grouped
 * by skill in review order: due skills first, then weakest. If a skill runs
 * dry the shortfall is topped up from the other skills.
 */
function selectReview(ctx: SelectionContext, count: number): SelectedQuestion[] {
  const skills = reviewSkills(ctx);
  if (skills.length === 0) return [];
  const used = new Set<string>();
  const out: SelectedQuestion[] = [];
  const base = Math.floor(count / skills.length);
  const extra = count % skills.length;
  skills.forEach((id, i) => {
    out.push(...selectQuestionsForSkill(ctx, id, base + (i < extra ? 1 : 0), used));
  });
  for (const id of skills) {
    if (out.length >= count) break;
    out.push(...selectQuestionsForSkill(ctx, id, count - out.length, used));
  }
  return out;
}

/** Daily challenge: 5 questions from due skills first, then the weakest. */
export function selectDaily(ctx: SelectionContext): SelectedQuestion[] {
  return selectReview(ctx, DAILY_SIZE);
}

/** Practice: 8 questions from due skills, falling back to weak ones. */
export function selectPractice(ctx: SelectionContext): SelectedQuestion[] {
  return selectReview(ctx, PRACTICE_SIZE);
}

function pathIndex(skillId: string): number {
  const s = SKILLS.findIndex((x) => x.id === skillId);
  return s < 0 ? Number.MAX_SAFE_INTEGER : s;
}
