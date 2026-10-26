import type { Skill, UnitDef } from './types.ts';

/** Units in path order. Skill order within and across units is the global path order. */
export const UNITS: readonly UnitDef[] = [
  {
    id: 'u1',
    title: 'Laplace & Transfer Functions',
    description: 'Move from the time domain to s, and read a system off its transfer function.',
    skills: [
      { id: 'laplace-basics', title: 'Laplace basics' },
      { id: 'transfer-functions', title: 'Transfer functions' },
      { id: 'poles-zeros', title: 'Poles & zeros' },
    ],
  },
  {
    id: 'u2',
    title: 'Block Diagrams',
    description: 'Series, parallel and feedback: collapse any diagram to one transfer function.',
    skills: [{ id: 'block-diagrams', title: 'Block diagram algebra' }],
  },
  {
    id: 'u3',
    title: 'First-Order Response',
    description: 'Time constants, DC gain and how a single pole responds to a step.',
    skills: [{ id: 'first-order', title: 'First-order systems' }],
  },
  {
    id: 'u4',
    title: 'Second-Order Response',
    description: 'Damping ratio and natural frequency, and the overshoot and timing they produce.',
    skills: [
      { id: 'second-order-params', title: 'ζ, ωn & damping' },
      { id: 'second-order-specs', title: 'Overshoot, settling & peak time' },
    ],
  },
  {
    id: 'u5',
    title: 'Stability',
    description: 'Where the poles sit decides everything; Routh–Hurwitz tells you without solving.',
    skills: [
      { id: 'stability-poles', title: 'Stability & pole locations' },
      { id: 'routh-hurwitz', title: 'Routh–Hurwitz' },
    ],
  },
  {
    id: 'u6',
    title: 'Steady-State Error',
    description: 'Count the integrators, then predict the error to steps and ramps.',
    skills: [
      { id: 'system-type', title: 'System type' },
      { id: 'steady-state-error', title: 'Steady-state error' },
    ],
  },
  {
    id: 'u7',
    title: 'Root Locus',
    description: 'Sketch how closed-loop poles move as the gain K sweeps from 0 to ∞.',
    skills: [{ id: 'root-locus', title: 'Root locus' }],
  },
  {
    id: 'u8',
    title: 'Frequency Response',
    description: 'Sinusoids in, sinusoids out: gain and phase versus ω, on Bode axes.',
    skills: [
      { id: 'frequency-response', title: 'Frequency response' },
      { id: 'bode-plots', title: 'Bode plots' },
    ],
  },
  {
    id: 'u9',
    title: 'Nyquist & Margins',
    description: 'Encirclements of −1 and how much gain and phase you can spare.',
    skills: [
      { id: 'nyquist', title: 'Nyquist criterion' },
      { id: 'stability-margins', title: 'Gain & phase margins' },
    ],
  },
  {
    id: 'u10',
    title: 'PID Control',
    description: 'What P, I and D each buy you, and what they cost.',
    skills: [{ id: 'pid-control', title: 'P, PI, PD & PID' }],
  },
  {
    id: 'u11',
    title: 'State Space',
    description: 'ẋ = Ax + Bu: eigenvalues, stability, controllability and observability.',
    skills: [
      { id: 'state-space-models', title: 'State-space models' },
      { id: 'ss-eigenvalues', title: 'Eigenvalues & stability' },
      { id: 'controllability-observability', title: 'Controllability & observability' },
    ],
  },
];

/** All skills, flattened, in global path order. */
export const SKILLS: readonly Skill[] = UNITS.flatMap((u) => u.skills.map((s) => ({ ...s, unitId: u.id }))).map(
  (s, index) => ({ ...s, index }),
);

const skillById = new Map(SKILLS.map((s) => [s.id, s]));
const unitById = new Map(UNITS.map((u) => [u.id, u]));

export function getSkill(skillId: string): Skill | undefined {
  return skillById.get(skillId);
}

export function getUnit(unitId: string): UnitDef | undefined {
  return unitById.get(unitId);
}

export function isSkillId(skillId: string): boolean {
  return skillById.has(skillId);
}
