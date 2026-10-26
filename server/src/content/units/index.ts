/**
 * Registered unit content. Each content pack owns one reserved slot below:
 * add your import lines under your pack's "imports" marker and your array
 * entries under your pack's "entries" marker. Touch nothing else, so packs
 * written in parallel merge without conflicts. Order inside the array does not
 * matter (the curriculum defines path order). `_fixtures.ts` is test-only and
 * must never be registered here.
 */
import type { UnitContent } from '../types.ts';

// --- pack A imports (U1–U3) ---
import u01 from './u01-laplace.ts';
import u02 from './u02-block-diagrams.ts';
import u03 from './u03-first-order.ts';

// --- pack B imports (U4–U6) ---
import u04 from './u04-second-order.ts';
import u05 from './u05-stability.ts';
import u06 from './u06-steady-state-error.ts';

// --- pack C imports (U7–U9) ---

// --- pack D imports (U10–U11) ---

export const UNIT_CONTENT: UnitContent[] = [
  // --- pack A entries (U1–U3) ---
  u01,
  u02,
  u03,

  // --- pack B entries (U4–U6) ---
  u04,
  u05,
  u06,

  // --- pack C entries (U7–U9) ---

  // --- pack D entries (U10–U11) ---
];
