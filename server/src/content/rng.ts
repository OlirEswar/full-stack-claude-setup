/** A source of uniform floats in [0, 1), like Math.random. */
export type Rng = () => number;

/** Seedable mulberry32 PRNG. Same seed, same sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw a 32-bit unsigned seed from another rng (e.g. to store with a generated item and replay it). */
export function randomSeed(rng: Rng): number {
  return Math.floor(rng() * 4294967296) >>> 0;
}

/** Hash a string to a 32-bit seed (FNV-1a). */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Uniform integer in [min, max], inclusive on both ends. */
export function int(rng: Rng, min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Uniformly pick one element. Throws on an empty array. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() from empty array');
  return items[Math.floor(rng() * items.length)] as T;
}

/** Fisher–Yates shuffle. Returns a new array; the input is not modified. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** True with probability p. */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}
