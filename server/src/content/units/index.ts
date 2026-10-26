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

// --- pack B imports (U4–U6) ---

// --- pack C imports (U7–U9) ---

// --- pack D imports (U10–U11) ---
import u10Pid from './u10-pid.ts';
import u11StateSpace from './u11-state-space.ts';

export const UNIT_CONTENT: UnitContent[] = [
  // --- pack A entries (U1–U3) ---

  // --- pack B entries (U4–U6) ---

  // --- pack C entries (U7–U9) ---

  // --- pack D entries (U10–U11) ---
  u10Pid,
  u11StateSpace,
];
