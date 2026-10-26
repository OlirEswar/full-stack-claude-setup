import { getSkill, isSkillId, UNITS } from './curriculum.ts';
import type { Difficulty, Generator, Skill, StaticQuestion, UnitContent } from './types.ts';
import { UNIT_CONTENT } from './units/index.ts';

export { getSkill };

export interface ContentRegistry {
  getSkill(skillId: string): Skill | undefined;
  staticItemsFor(skillId: string, d?: Difficulty): StaticQuestion[];
  generatorsFor(skillId: string, d?: Difficulty): Generator[];
  allStatic(): StaticQuestion[];
  allGenerators(): Generator[];
  getStaticItem(id: string): StaticQuestion | undefined;
  getGenerator(id: string): Generator | undefined;
}

/**
 * Build an in-memory registry from unit content. Throws on duplicate item or
 * generator ids, unknown skill ids, or unknown unit ids, so broken packs fail fast.
 */
export function createRegistry(units: readonly UnitContent[]): ContentRegistry {
  const items = new Map<string, StaticQuestion>();
  const generators = new Map<string, Generator>();
  const knownUnits = new Set<string>([...UNITS.map((u) => u.id), 'fixtures']);

  for (const unit of units) {
    if (!knownUnits.has(unit.unitId)) throw new Error(`content: unknown unitId "${unit.unitId}"`);
    for (const item of unit.items) {
      if (items.has(item.id)) throw new Error(`content: duplicate static item id "${item.id}"`);
      if (!isSkillId(item.skillId)) throw new Error(`content: item "${item.id}" has unknown skillId "${item.skillId}"`);
      items.set(item.id, item);
    }
    for (const gen of unit.generators) {
      if (generators.has(gen.id)) throw new Error(`content: duplicate generator id "${gen.id}"`);
      if (!isSkillId(gen.skillId)) throw new Error(`content: generator "${gen.id}" has unknown skillId "${gen.skillId}"`);
      generators.set(gen.id, gen);
    }
  }

  const staticList = [...items.values()];
  const generatorList = [...generators.values()];

  return {
    getSkill,
    staticItemsFor: (skillId, d) =>
      staticList.filter((q) => q.skillId === skillId && (d === undefined || q.difficulty === d)),
    generatorsFor: (skillId, d) =>
      generatorList.filter((g) => g.skillId === skillId && (d === undefined || g.difficulties.includes(d))),
    allStatic: () => staticList.slice(),
    allGenerators: () => generatorList.slice(),
    getStaticItem: (id) => items.get(id),
    getGenerator: (id) => generators.get(id),
  };
}

/** The app-wide registry, built from everything registered in `units/index.ts`. */
export const registry: ContentRegistry = createRegistry(UNIT_CONTENT);

export const staticItemsFor = registry.staticItemsFor;
export const generatorsFor = registry.generatorsFor;
export const allStatic = registry.allStatic;
export const allGenerators = registry.allGenerators;
export const getStaticItem = registry.getStaticItem;
export const getGenerator = registry.getGenerator;
