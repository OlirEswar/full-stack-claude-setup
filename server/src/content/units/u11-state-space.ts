/**
 * Content pack D, U11: state space (models, eigenvalues & stability,
 * controllability & observability).
 */
import { defineGenerator, defineUnit, nice } from '../authoring.ts';
import { chance, int, pick, type Rng } from '../rng.ts';
import type { Difficulty } from '../types.ts';

/** "[a b; c d]" with Unicode minus signs. */
export function fmtMatrix(a: number, b: number, c: number, d: number): string {
  return `[${nice(a)} ${nice(b)}; ${nice(c)} ${nice(d)}]`;
}

/** Column vector "[b1; b2]". */
export function fmtColumn(b1: number, b2: number): string {
  return `[${nice(b1)}; ${nice(b2)}]`;
}

/** Signed term for polynomials: "+ 3", "− 3". */
function signed(x: number): string {
  return x < 0 ? `− ${nice(-x)}` : `+ ${nice(x)}`;
}

/** "λ² − Tλ + D" with zero terms dropped and unit coefficients simplified. */
function charPoly(tr: number, det: number): string {
  let out = 'λ²';
  if (tr !== 0) out += ` ${signed(-tr)}λ`.replace(/([+−]) 1λ/, '$1 λ');
  if (det !== 0) out += ` ${signed(det)}`;
  return out;
}

/** Divisors (positive and negative) of a nonzero integer. */
function divisors(n: number): number[] {
  const m = Math.abs(n);
  const out: number[] = [];
  for (let k = 1; k <= m; k++) if (m % k === 0) out.push(k, -k);
  return out;
}

/**
 * Random integer 2×2 matrix with eigenvalues l1, l2. Pick a, set d = tr − a, then
 * b·c = ad − det = −(a − l1)(a − l2); choose b among the divisors.
 */
function matrixWithEigenvalues(rng: Rng, l1: number, l2: number): [number, number, number, number] {
  const tr = l1 + l2;
  const lo = Math.min(l1, l2);
  const hi = Math.max(l1, l2);
  for (let tries = 0; tries < 20; tries++) {
    const a = int(rng, lo - 2, hi + 2);
    const d = tr - a;
    const p = -(a - l1) * (a - l2);
    if (p === 0) {
      const off = pick(rng, [1, 2, 3, -1, -2]);
      return chance(rng, 0.5) ? [a, off, 0, d] : [a, 0, off, d];
    }
    const options = divisors(p).filter((k) => Math.abs(k) <= 9 && Math.abs(p / k) <= 9);
    if (options.length > 0) {
      const b = pick(rng, options);
      return [a, b, p / b, d];
    }
  }
  // Fallback: triangular matrix, eigenvalues on the diagonal.
  return [l1, int(rng, 1, 3), 0, l2];
}

export default defineUnit({
  unitId: 'u11',
  items: [
    // --- state-space-models ------------------------------------------------
    {
      id: 'state-space-models/b-dimensions',
      skillId: 'state-space-models',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'ẋ = Ax + Bu, y = Cx + Du with n states, m inputs and p outputs. What are the dimensions of B?',
      choices: ['n × m', 'm × n', 'n × n', 'p × n'],
      answer: 0,
      explanation: 'B maps the m-vector u into the n-vector ẋ, so it is n × m. (A is n × n, C is p × n, D is p × m.)',
    },
    {
      id: 'state-space-models/order-equals-states',
      skillId: 'state-space-models',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'A single 3rd-order linear ODE in y needs 3 state variables, e.g. x = (y, ẏ, ÿ).',
      answer: true,
      explanation: 'An nth-order ODE needs n initial conditions to fix its solution, so its minimal state has n components.',
    },
    {
      id: 'state-space-models/matrix-roles',
      skillId: 'state-space-models',
      difficulty: 1,
      kind: 'match',
      prompt: 'Match each matrix in ẋ = Ax + Bu, y = Cx + Du to its role.',
      left: ['A', 'B', 'C', 'D'],
      right: [
        'How the states evolve on their own',
        'How the inputs drive the states',
        'How the states appear in the outputs',
        'Direct feedthrough from input to output',
      ],
      answer: [0, 1, 2, 3],
      explanation: 'A sets the internal dynamics, B injects the input, C reads out the states, and D passes the input straight to the output.',
    },
    {
      id: 'state-space-models/ode-to-a',
      skillId: 'state-space-models',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'ÿ + 3ẏ + 2y = u with states x1 = y, x2 = ẏ. What is A?',
      choices: ['[0 1; −2 −3]', '[0 1; 2 3]', '[1 0; −2 −3]', '[0 1; −3 −2]'],
      answer: 0,
      explanation: 'ẋ1 = x2 gives row [0 1]; ẋ2 = ÿ = −2y − 3ẏ + u gives row [−2 −3].',
    },
    {
      id: 'state-space-models/tf-formula',
      skillId: 'state-space-models',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'Which expression gives the transfer function of ẋ = Ax + Bu, y = Cx + Du?',
      choices: ['C(sI − A)⁻¹B + D', 'B(sI − A)⁻¹C + D', 'C(sI + A)⁻¹B + D', '(sI − A)⁻¹ + D'],
      answer: 0,
      explanation: 'Laplace with x(0) = 0: X = (sI − A)⁻¹BU, so Y = [C(sI − A)⁻¹B + D]U.',
    },
    {
      id: 'state-space-models/d-proper',
      skillId: 'state-space-models',
      difficulty: 2,
      kind: 'true_false',
      prompt: 'If D ≠ 0, the transfer function is strictly proper.',
      answer: false,
      explanation: 'As s → ∞, C(sI − A)⁻¹B → 0, so G(∞) = D. With D ≠ 0 it is proper but not strictly proper (equal degrees).',
    },
    {
      id: 'state-space-models/dc-gain',
      skillId: 'state-space-models',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'A = [0 1; −6 −5], B = [0; 1], C = [1 0], D = 0. What is the DC gain G(0)?',
      answer: 1 / 6,
      tolerance: { abs: 0.005 },
      explanation: 'This is controllable canonical form of G(s) = 1/(s² + 5s + 6), so G(0) = 1/6 ≈ 0.167 (equivalently −CA⁻¹B + D).',
    },
    {
      id: 'state-space-models/not-unique',
      skillId: 'state-space-models',
      difficulty: 3,
      kind: 'true_false',
      prompt: 'A given transfer function has exactly one state-space realization (A, B, C, D).',
      answer: false,
      explanation: 'Any invertible change of state x = Tz gives (T⁻¹AT, T⁻¹B, CT, D) with the same G(s), so realizations are far from unique.',
    },
    {
      id: 'state-space-models/canonical-c',
      skillId: 'state-space-models',
      difficulty: 4,
      kind: 'mcq',
      prompt: 'G(s) = (s + 3)/(s² + 4s + 5) in controllable canonical form: A = [0 1; −5 −4], B = [0; 1], D = 0. What is C?',
      choices: ['[3 1]', '[1 3]', '[5 4]', '[1 0]'],
      answer: 0,
      explanation: 'With x1 the "base" state, y = b0·x1 + b1·x2 = 3x1 + x2 for numerator b1·s + b0 = s + 3, so C = [3 1].',
    },
    {
      id: 'state-space-models/similarity-invariants',
      skillId: 'state-space-models',
      difficulty: 4,
      kind: 'multi_select',
      prompt: 'Under a change of state coordinates x = Tz (T invertible), which are unchanged? Select all that apply.',
      choices: ['The eigenvalues of A', 'The transfer function G(s)', 'Whether the system is controllable', 'The entries of A', 'The C matrix'],
      answer: [0, 1, 2],
      explanation: 'T⁻¹AT has the same characteristic polynomial, G(s) is input-output so it cannot change, and rank of the controllability matrix is preserved; the matrices themselves change.',
    },
    {
      id: 'state-space-models/minimal-order',
      skillId: 'state-space-models',
      difficulty: 5,
      kind: 'numeric',
      prompt: 'How many states does a minimal realization of G(s) = (s + 1)/((s + 1)(s + 2)) have?',
      answer: 1,
      tolerance: { abs: 0.01 },
      explanation: 'The (s + 1) factor cancels, leaving G(s) = 1/(s + 2), which needs only one state; a 2-state realization would be non-minimal.',
    },

    // --- ss-eigenvalues ----------------------------------------------------
    {
      id: 'ss-eigenvalues/stability-condition',
      skillId: 'ss-eigenvalues',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'ẋ = Ax is asymptotically stable exactly when every eigenvalue of A has a negative real part.',
      answer: true,
      explanation: 'Solutions are combinations of e^(λt) terms (times polynomials in t), which all decay to zero iff Re(λ) < 0 for every eigenvalue.',
    },
    {
      id: 'ss-eigenvalues/diagonal',
      skillId: 'ss-eigenvalues',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'What are the eigenvalues of A = [−2 0; 0 −5]?',
      choices: ['−2 and −5', '2 and 5', '−7 only', '0 and −7'],
      answer: 0,
      explanation: 'For a diagonal (or triangular) matrix the eigenvalues are the diagonal entries.',
    },
    {
      id: 'ss-eigenvalues/triangular-unstable',
      skillId: 'ss-eigenvalues',
      difficulty: 2,
      kind: 'true_false',
      prompt: 'A = [−1 4; 0 3]. The system ẋ = Ax is asymptotically stable.',
      answer: false,
      explanation: 'A is upper triangular, so its eigenvalues are −1 and 3; the eigenvalue at +3 makes the system unstable.',
    },
    {
      id: 'ss-eigenvalues/modes',
      skillId: 'ss-eigenvalues',
      difficulty: 2,
      kind: 'match',
      prompt: 'Match each eigenvalue (or pair) of A to the free-response mode it produces in ẋ = Ax.',
      left: ['λ = −2', 'λ = ±3j', 'λ = −1 ± 4j', 'λ = 1 ± 2j'],
      right: ['Decaying exponential, no oscillation', 'Sustained oscillation', 'Decaying oscillation', 'Growing oscillation'],
      answer: [0, 1, 2, 3],
      explanation: 'Each mode behaves like e^(σt)·cos(ωt) for λ = σ ± jω: the real part sets growth or decay, the imaginary part sets oscillation.',
    },
    {
      id: 'ss-eigenvalues/poles-vs-eigenvalues',
      skillId: 'ss-eigenvalues',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'How do the poles of G(s) = C(sI − A)⁻¹B + D relate to the eigenvalues of A?',
      choices: [
        'Every pole is an eigenvalue; they coincide if the realization is minimal',
        'Every eigenvalue is always a pole of G(s)',
        'They are unrelated',
        'The poles are the negatives of the eigenvalues',
      ],
      answer: 0,
      explanation: '(sI − A)⁻¹ has denominator det(sI − A), so poles come from eigenvalues, but pole-zero cancellations can hide uncontrollable or unobservable modes.',
    },
    {
      id: 'ss-eigenvalues/slow-mode',
      skillId: 'ss-eigenvalues',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'A = [0 1; −6 −5]. Which eigenvalue dominates the long-term response (the slowest mode)?',
      answer: -2,
      tolerance: { abs: 0.01 },
      explanation: 'det(sI − A) = s² + 5s + 6 = (s + 2)(s + 3), so λ = −2, −3; e^(−2t) decays slowest and dominates.',
    },
    {
      id: 'ss-eigenvalues/companion-stability',
      skillId: 'ss-eigenvalues',
      difficulty: 3,
      kind: 'multi_select',
      prompt: 'A = [0 1; −k −c]. For which (k, c) is ẋ = Ax asymptotically stable? Select all that apply.',
      choices: ['k = 2, c = 3', 'k = 1, c = 0.5', 'k = 4, c = 0', 'k = −1, c = 2', 'k = 3, c = −1'],
      answer: [0, 1],
      explanation: 'The characteristic polynomial is s² + c·s + k; a quadratic is stable iff both coefficients are positive. c = 0 gives undamped oscillation (marginal).',
    },
    {
      id: 'ss-eigenvalues/plot-marginal',
      skillId: 'ss-eigenvalues',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'The eigenvalues of a 3×3 A are plotted (all distinct). How does ẋ = Ax behave?',
      figure: {
        type: 'pole_zero',
        poles: [
          { re: -1, im: 2 },
          { re: -1, im: -2 },
          { re: 0, im: 0 },
        ],
        zeros: [],
      },
      choices: [
        'Marginally stable: bounded, but not all states decay to zero',
        'Asymptotically stable',
        'Unstable: some state grows without bound',
      ],
      answer: 0,
      explanation: 'The pair −1 ± 2j decays, but the simple eigenvalue at 0 gives a constant mode that never decays, so responses stay bounded without converging to 0.',
    },
    {
      id: 'ss-eigenvalues/trace-det-mixed',
      skillId: 'ss-eigenvalues',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'A = [1 2; 3 0]. What is the largest eigenvalue of A?',
      answer: 3,
      tolerance: { abs: 0.01 },
      explanation: 'tr A = 1 and det A = −6, so λ² − λ − 6 = (λ − 3)(λ + 2) = 0; the eigenvalues are 3 and −2.',
    },
    {
      id: 'ss-eigenvalues/trace-det-test',
      skillId: 'ss-eigenvalues',
      difficulty: 4,
      kind: 'true_false',
      prompt: 'Any real 2×2 matrix A with tr A < 0 and det A > 0 makes ẋ = Ax asymptotically stable.',
      answer: true,
      explanation: 'The characteristic polynomial is λ² − (tr A)λ + det A; both coefficients −tr A and det A are positive, which for a quadratic means both roots have Re < 0.',
    },
    {
      id: 'ss-eigenvalues/jordan-double-integrator',
      skillId: 'ss-eigenvalues',
      difficulty: 5,
      kind: 'mcq',
      prompt: 'A = [0 1; 0 0] (double integrator, u = 0). Both eigenvalues are 0. How does ẋ = Ax behave?',
      choices: [
        'Unstable: x1 can grow like t',
        'Marginally stable: all solutions stay bounded',
        'Asymptotically stable',
        'Cannot be determined from A',
      ],
      answer: 0,
      explanation: 'The repeated zero eigenvalue sits in a Jordan block: x1(t) = x1(0) + x2(0)·t grows without bound whenever x2(0) ≠ 0.',
    },
    {
      id: 'ss-eigenvalues/feedback-moves-eigs',
      skillId: 'ss-eigenvalues',
      difficulty: 5,
      kind: 'true_false',
      prompt: 'State feedback u = −Kx leaves the eigenvalues of the closed-loop system equal to those of A.',
      answer: false,
      explanation: 'The closed loop is ẋ = (A − BK)x, whose eigenvalues depend on K; if (A, B) is controllable, K can place them anywhere (in conjugate pairs).',
    },

    // --- controllability-observability -------------------------------------
    {
      id: 'controllability-observability/ctrb-matrix',
      skillId: 'controllability-observability',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'For a 2-state system ẋ = Ax + Bu, what is the controllability matrix?',
      choices: ['[B AB]', '[C; CA]', '[A B]', '[B A²B]'],
      answer: 0,
      explanation: 'For n states it is [B AB … Aⁿ⁻¹B]; with n = 2 that is [B AB].',
    },
    {
      id: 'controllability-observability/rank-test',
      skillId: 'controllability-observability',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'An n-state system is controllable exactly when its controllability matrix has rank n.',
      answer: true,
      explanation: 'Full rank means the directions B, AB, …, Aⁿ⁻¹B span the whole state space, so the input can steer the state anywhere.',
    },
    {
      id: 'controllability-observability/obsv-matrix',
      skillId: 'controllability-observability',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'For a 2-state system with output y = Cx, what is the observability matrix?',
      choices: ['[C; CA]', '[B AB]', '[C; A]', '[CA; CA²]'],
      answer: 0,
      explanation: 'Stack C, CA, …, CAⁿ⁻¹; for n = 2 that is [C; CA], and the system is observable iff it has rank 2.',
    },
    {
      id: 'controllability-observability/decoupled-rank',
      skillId: 'controllability-observability',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'A = [−1 0; 0 −2], B = [1; 0]. What is the rank of [B AB]?',
      answer: 1,
      tolerance: { abs: 0.01 },
      explanation: 'AB = [−1; 0], so [B AB] = [1 −1; 0 0] has rank 1: the input never reaches x2, which is decoupled.',
    },
    {
      id: 'controllability-observability/canonical-controllable',
      skillId: 'controllability-observability',
      difficulty: 3,
      kind: 'true_false',
      prompt: 'A = [0 1; −2 −3], B = [0; 1]. The pair (A, B) is controllable.',
      answer: true,
      explanation: 'AB = [1; −3], so [B AB] = [0 1; 1 −3] with determinant −1 ≠ 0: rank 2, controllable (as controllable canonical form always is).',
    },
    {
      id: 'controllability-observability/concepts',
      skillId: 'controllability-observability',
      difficulty: 3,
      kind: 'match',
      prompt: 'Match each property to its meaning.',
      left: ['Controllable', 'Observable', 'Stabilizable', 'Detectable'],
      right: [
        'The input can drive the state from any x0 to any target in finite time',
        'The initial state can be reconstructed from the input and output record',
        'Every uncontrollable mode is already stable',
        'Every unobservable mode is already stable',
      ],
      answer: [0, 1, 2, 3],
      explanation: 'Stabilizable and detectable are the weaker versions: whatever you cannot steer (or see) must decay by itself.',
    },
    {
      id: 'controllability-observability/what-ctrb-buys',
      skillId: 'controllability-observability',
      difficulty: 4,
      kind: 'multi_select',
      prompt: 'If (A, B) is controllable, which of these are guaranteed? Select all that apply.',
      choices: [
        'u = −Kx can place all closed-loop eigenvalues anywhere (in conjugate pairs)',
        'The state can be steered from any x0 to any xf in finite time',
        'The open-loop system ẋ = Ax is stable',
        'The state can be estimated from y',
      ],
      answer: [0, 1],
      explanation: 'Controllability gives arbitrary pole placement and full steering. It says nothing about open-loop stability, and state estimation needs observability.',
    },
    {
      id: 'controllability-observability/cancellation',
      skillId: 'controllability-observability',
      difficulty: 4,
      kind: 'mcq',
      prompt: 'G(s) = (s + 1)/((s + 1)(s + 2)) is realized with 2 states in controllable canonical form. That realization is:',
      choices: ['Controllable but not observable', 'Observable but not controllable', 'Both controllable and observable', 'Neither'],
      answer: 0,
      explanation: 'Controllable canonical form is always controllable; a 2-state realization of a 1st-order G(s) is non-minimal, so the cancelled mode at −1 must be unobservable.',
    },
    {
      id: 'controllability-observability/duality',
      skillId: 'controllability-observability',
      difficulty: 4,
      kind: 'true_false',
      prompt: '(A, B) is controllable if and only if (Aᵀ, Bᵀ) is observable, i.e. the system with state matrix Aᵀ and output matrix Bᵀ.',
      answer: true,
      explanation: 'The observability matrix of (Aᵀ, Bᵀ) is [Bᵀ; BᵀAᵀ; …], the transpose of [B AB …], and a matrix and its transpose have the same rank.',
    },
    {
      id: 'controllability-observability/lose-control',
      skillId: 'controllability-observability',
      difficulty: 5,
      kind: 'numeric',
      prompt: 'A = [−1 k; 0 −2], B = [0; 1]. For which value of k is (A, B) NOT controllable?',
      answer: 0,
      tolerance: { abs: 0.01 },
      explanation: 'AB = [k; −2], so det [B AB] = det [0 k; 1 −2] = −k. It is singular only at k = 0, where x1 no longer couples to x2 or the input.',
    },
    {
      id: 'controllability-observability/which-sensor',
      skillId: 'controllability-observability',
      difficulty: 5,
      kind: 'mcq',
      prompt: 'Double integrator ẋ1 = x2, ẋ2 = u (position x1, velocity x2). Which single measurement makes the system observable?',
      choices: ['y = x1 only', 'y = x2 only', 'Either one works', 'Neither works'],
      answer: 0,
      explanation: 'C = [1 0] gives [C; CA] = [1 0; 0 1], rank 2. With C = [0 1], CA = [0 0]: velocity alone never reveals the starting position.',
    },
  ],
  generators: [
    defineGenerator({
      id: 'ss-eigenvalues-2x2',
      skillId: 'ss-eigenvalues',
      difficulties: [2, 3, 4],
      generate(rng, d: Difficulty) {
        // d2: two distinct negative eigenvalues; d3: any integers in −5..4; d4: stability call.
        let l1: number;
        let l2: number;
        if (d === 2) {
          l1 = int(rng, -6, -1);
          do l2 = int(rng, -6, -1);
          while (l2 === l1);
        } else {
          l1 = int(rng, -5, 4);
          do l2 = int(rng, -5, 4);
          while (l2 === l1);
        }
        const [a, b, c, dd] = matrixWithEigenvalues(rng, l1, l2);
        const tr = l1 + l2;
        const det = l1 * l2;
        const hi = Math.max(l1, l2);
        const lo = Math.min(l1, l2);
        const A = fmtMatrix(a, b, c, dd);
        const work = `tr A = ${nice(tr)}, det A = ${nice(det)}, so ${charPoly(tr, det)} = 0 gives λ = ${nice(hi)}, ${nice(lo)}.`;

        if (d === 4) {
          const verdict = hi < 0 ? 0 : hi === 0 ? 1 : 2;
          const reason =
            verdict === 0
              ? 'Both are negative: asymptotically stable.'
              : verdict === 1
                ? 'A simple eigenvalue at 0 with the other negative: marginally stable.'
                : `λ = ${nice(hi)} > 0: unstable.`;
          return {
            skillId: 'ss-eigenvalues',
            difficulty: d,
            kind: 'mcq',
            prompt: `A = ${A}. Using the trace and determinant, classify ẋ = Ax.`,
            choices: ['Asymptotically stable', 'Marginally stable', 'Unstable'],
            answer: verdict,
            explanation: `${work} ${reason}`,
          };
        }
        const askHigh = chance(rng, 0.5);
        return {
          skillId: 'ss-eigenvalues',
          difficulty: d,
          kind: 'numeric',
          prompt: `A = ${A}. What is the ${askHigh ? 'larger' : 'smaller'} eigenvalue of A?`,
          answer: askHigh ? hi : lo,
          tolerance: { abs: 0.01 },
          explanation: work,
        };
      },
    }),
    defineGenerator({
      id: 'controllability-2x2',
      skillId: 'controllability-observability',
      difficulties: [3, 4],
      generate(rng, d: Difficulty) {
        const span = d === 3 ? 2 : 3;
        let a: number, b: number, c: number, dd: number, b1: number, b2: number;
        if (chance(rng, 0.5)) {
          // Uncontrollable: make B an eigenvector of A (AB = μB), so [B AB] has rank 1.
          const mu = int(rng, -3, 2);
          const lead = pick(rng, [1, -1]);
          const other = int(rng, -2, 2);
          const free1 = int(rng, -span, span);
          const free2 = int(rng, -span, span);
          if (chance(rng, 0.5)) {
            // b1 = ±1: a·b1 + b·b2 = μ·b1, c·b1 + d·b2 = μ·b2.
            b1 = lead;
            b2 = other;
            b = free1;
            dd = free2;
            a = (mu * b1 - b * b2) / b1;
            c = (mu * b2 - dd * b2) / b1;
          } else {
            // b2 = ±1: a·b1 + b·b2 = μ·b1, c·b1 + d·b2 = μ·b2.
            b2 = lead;
            b1 = other;
            a = free1;
            c = free2;
            b = (mu * b1 - a * b1) / b2;
            dd = (mu * b2 - c * b1) / b2;
          }
        } else {
          let tries = 0;
          do {
            a = int(rng, -span, span);
            b = int(rng, -span, span);
            c = int(rng, -span, span);
            dd = int(rng, -span, span);
            b1 = int(rng, -2, 2);
            b2 = int(rng, -2, 2);
            tries++;
          } while (b1 * (c * b1 + dd * b2) - b2 * (a * b1 + b * b2) === 0 && tries < 50);
          if (b1 * (c * b1 + dd * b2) - b2 * (a * b1 + b * b2) === 0) {
            [a, b, c, dd, b1, b2] = [0, 1, -2, -3, 0, 1];
          }
        }
        // Avoid "−0" style artefacts from the divisions above.
        [a, b, c, dd] = [a, b, c, dd].map((x) => x + 0) as [number, number, number, number];
        const ab1 = a * b1 + b * b2;
        const ab2 = c * b1 + dd * b2;
        const det = b1 * ab2 - b2 * ab1;
        const controllable = det !== 0;
        return {
          skillId: 'controllability-observability',
          difficulty: d,
          kind: 'true_false',
          prompt: `A = ${fmtMatrix(a, b, c, dd)}, B = ${fmtColumn(b1, b2)}. True or false: (A, B) is controllable.`,
          answer: controllable,
          explanation:
            `AB = ${fmtColumn(ab1, ab2)}, so [B AB] = ${fmtMatrix(b1, ab1, b2, ab2)} with determinant ${nice(det)}: ` +
            (controllable ? 'rank 2, controllable.' : 'rank 1, not controllable.'),
        };
      },
    }),
  ],
});
