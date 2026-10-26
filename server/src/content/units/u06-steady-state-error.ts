/**
 * Unit 6: steady-state error (skills `system-type`, `steady-state-error`).
 * All error questions assume a stable unity-feedback loop around G(s).
 */
import { defineGenerator, defineUnit, nice } from '../authoring.ts';
import { chance, int, pick } from '../rng.ts';

const SUP = ['', '', '²', '³', '⁴', '⁵', '⁶'];

/** s-power term: "", "s", "s²", ... */
function sPow(n: number): string {
  return n === 0 ? '' : `s${SUP[n]}`;
}

/** Format a polynomial from coefficients, highest power first: [1, 5, 6, 0] → "s³ + 5s² + 6s". */
export function poly(coeffs: number[]): string {
  const deg = coeffs.length - 1;
  const terms: string[] = [];
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const p = deg - i;
    const mag = Math.abs(c);
    const body = p === 0 ? nice(mag) : `${mag === 1 ? '' : nice(mag)}${sPow(p)}`;
    if (terms.length === 0) terms.push(c < 0 ? `−${body}` : body);
    else terms.push(c < 0 ? `− ${body}` : `+ ${body}`);
  });
  return terms.join(' ') || '0';
}

/** Multiply polynomials given as coefficient arrays (highest power first). */
function mul(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j]! += x * y)));
  return out;
}

const TYPE_CHOICES = ['Type 0', 'Type 1', 'Type 2', 'Type 3'];

export default defineUnit({
  unitId: 'u6',
  items: [
    // ---------------------------------------------------------------- system-type
    {
      id: 'system-type/type-one-basic',
      skillId: 'system-type',
      difficulty: 1,
      kind: 'numeric',
      prompt: 'G(s) = 10/(s(s + 2)) is the open-loop transfer function of a unity-feedback loop. What is the system type?',
      answer: 1,
      tolerance: { abs: 0 },
      explanation: 'System type is the number of free integrators (poles at s = 0) in G(s): one factor of s, so type 1.',
    },
    {
      id: 'system-type/type-two',
      skillId: 'system-type',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'What is the system type of G(s) = 5(s + 1)/(s²(s + 4))?',
      choices: TYPE_CHOICES,
      answer: 2,
      explanation: 's² in the denominator means two poles at the origin, so the open loop is type 2.',
    },
    {
      id: 'system-type/type-zero',
      skillId: 'system-type',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'What is the system type of G(s) = (s + 3)/((s + 1)(s + 5))?',
      choices: TYPE_CHOICES,
      answer: 0,
      explanation: 'No pole sits at s = 0, so there are no free integrators: type 0. The number of poles does not matter.',
    },
    {
      id: 'system-type/zero-at-origin',
      skillId: 'system-type',
      difficulty: 2,
      kind: 'true_false',
      prompt: 'Adding a zero at s = 0 to G(s) increases the system type by one.',
      answer: false,
      explanation: 'A zero at the origin is a differentiator; it cancels one integrator, so it lowers the type by one.',
    },
    {
      id: 'system-type/type-error-match',
      skillId: 'system-type',
      difficulty: 2,
      kind: 'match',
      prompt: 'Unity feedback, stable loop. Match each system type to its steady-state error behavior.',
      left: ['Type 0', 'Type 1', 'Type 2'],
      right: [
        'Finite step error, infinite ramp error',
        'Zero step error, finite ramp error',
        'Zero step and ramp error, finite parabola error',
      ],
      answer: [0, 1, 2],
      explanation: 'Each integrator lets the loop track one more power of t with zero error: type N tracks t^(N−1) perfectly.',
    },
    {
      id: 'system-type/jw-poles-not-integrators',
      skillId: 'system-type',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'What is the system type of G(s) = 4/(s(s² + 4))?',
      choices: TYPE_CHOICES,
      answer: 1,
      explanation: 'Only poles exactly at s = 0 count. The ±2j poles of s² + 4 are on the jω axis but are not integrators: type 1.',
    },
    {
      id: 'system-type/expanded-denominator',
      skillId: 'system-type',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'What is the system type of G(s) = (s + 2)/(s³ + 5s² + 6s)?',
      answer: 1,
      tolerance: { abs: 0 },
      explanation: 'Factor the denominator: s(s + 2)(s + 3). There is one factor of s, so type 1 (the zero at −2 cancels a non-origin pole).',
    },
    {
      id: 'system-type/type-one-select',
      skillId: 'system-type',
      difficulty: 3,
      kind: 'multi_select',
      prompt: 'Which open-loop transfer functions are type 1?',
      choices: ['1/(s(s + 1))', '(s + 2)/(s² + 3s)', '1/(s² + s + 1)', '(s + 1)/(s²(s + 5))', '10/(s + 1)', 's/(s²(s + 2))'],
      answer: [0, 1, 5],
      explanation:
        's² + 3s = s(s + 3) has one integrator, and s/s² nets one. s² + s + 1 has no root at 0, and s²(s + 5) is type 2.',
    },
    {
      id: 'system-type/pi-raises-type',
      skillId: 'system-type',
      difficulty: 4,
      kind: 'mcq',
      prompt: 'A PI controller Kp + Ki/s is placed in series with a type-0 plant (Ki ≠ 0). What is the type of the open loop?',
      choices: TYPE_CHOICES,
      answer: 1,
      explanation: 'Kp + Ki/s = (Kp·s + Ki)/s contributes one pole at the origin, so the loop becomes type 1.',
    },
    {
      id: 'system-type/open-loop-defined',
      skillId: 'system-type',
      difficulty: 4,
      kind: 'true_false',
      prompt:
        'For a unity-feedback loop, the system type is read from the closed-loop transfer function T(s) = G/(1 + G).',
      answer: false,
      explanation: 'Type counts integrators in the open-loop G(s). Closing the loop moves those poles away from the origin.',
    },

    // ---------------------------------------------------------------- steady-state-error
    {
      id: 'steady-state-error/kp-definition',
      skillId: 'steady-state-error',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'For a unity-feedback loop, how is the position error constant Kp defined?',
      choices: ['lim s→0 of G(s)', 'lim s→0 of s·G(s)', 'lim s→∞ of G(s)', 'lim s→0 of G(s)/(1 + G(s))'],
      answer: 0,
      explanation: 'Kp = G(0) (the DC loop gain), and the step error is 1/(1 + Kp). s·G(s) at s → 0 is Kv, used for ramps.',
    },
    {
      id: 'steady-state-error/step-type0',
      skillId: 'steady-state-error',
      difficulty: 1,
      kind: 'numeric',
      prompt: 'Unity feedback around G(s) = 9/(s + 1). What is the steady-state error to a unit step?',
      answer: 0.1,
      tolerance: {},
      explanation: 'Kp = G(0) = 9, so e(∞) = 1/(1 + Kp) = 1/10 = 0.1.',
    },
    {
      id: 'steady-state-error/ramp-type1',
      skillId: 'steady-state-error',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'Unity feedback around G(s) = 10/(s(s + 2)). What is the steady-state error to a unit ramp?',
      answer: 0.2,
      tolerance: {},
      explanation: 'Kv = lim s→0 s·G(s) = 10/2 = 5, so e(∞) = 1/Kv = 0.2.',
    },
    {
      id: 'steady-state-error/step-type1',
      skillId: 'steady-state-error',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'Unity feedback around G(s) = 10/(s(s + 2)). What is the steady-state error to a unit step?',
      choices: ['0', '0.2', '1/11', '∞'],
      answer: 0,
      explanation: 'The integrator makes Kp = G(0) = ∞, so the step error 1/(1 + Kp) is 0. 0.2 is the ramp error.',
    },
    {
      id: 'steady-state-error/gain-never-eliminates',
      skillId: 'steady-state-error',
      difficulty: 2,
      kind: 'true_false',
      prompt: 'For a stable type-0 loop, raising the gain reduces the step error but can never make it exactly zero.',
      answer: true,
      explanation: 'e = 1/(1 + Kp) shrinks as Kp grows but stays positive for any finite gain; only an integrator drives it to 0.',
    },
    {
      id: 'steady-state-error/ramp-type0',
      skillId: 'steady-state-error',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'Unity feedback around G(s) = 20/((s + 1)(s + 4)). What is the steady-state error to a unit ramp?',
      choices: ['∞', '0', '1/6', '0.2'],
      answer: 0,
      explanation: 'Type 0 means Kv = lim s→0 s·G(s) = 0, so e = 1/Kv = ∞: the output falls further and further behind.',
    },
    {
      id: 'steady-state-error/ramp-with-zero',
      skillId: 'steady-state-error',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'Unity feedback around G(s) = 20(s + 3)/(s(s + 4)(s + 5)). What is the steady-state error to a unit ramp?',
      answer: 1 / 3,
      tolerance: {},
      explanation: 'Kv = lim s→0 s·G(s) = 20·3/(4·5) = 3, so e(∞) = 1/Kv ≈ 0.333.',
    },
    {
      id: 'steady-state-error/zero-step-error',
      skillId: 'steady-state-error',
      difficulty: 3,
      kind: 'multi_select',
      prompt: 'A stable unity-feedback loop has a type-0 plant. Which changes give zero steady-state step error (if the loop stays stable)?',
      choices: [
        'Add an integrator (I action) to the controller',
        'Increase the proportional gain',
        'Add derivative action',
        'Use a PI controller instead of P',
      ],
      answer: [0, 3],
      explanation: 'Zero step error needs a free integrator (type ≥ 1). Gain only shrinks 1/(1 + Kp); D action has no effect at DC.',
    },
    {
      id: 'steady-state-error/step-magnitude',
      skillId: 'steady-state-error',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'Unity feedback around G(s) = 4/(s + 1). The reference is a step of height 5. What is the steady-state error?',
      answer: 1,
      tolerance: {},
      explanation: 'The error scales with the input: e = R/(1 + Kp) = 5/(1 + 4) = 1.',
    },
    {
      id: 'steady-state-error/parabola',
      skillId: 'steady-state-error',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'Unity feedback around G(s) = 10(s + 1)/(s²(s + 5)) (closed loop is stable). Error to a unit parabola r = t²/2?',
      answer: 0.5,
      tolerance: {},
      explanation: 'Ka = lim s→0 s²·G(s) = 10·1/5 = 2, so e(∞) = 1/Ka = 0.5.',
    },
    {
      id: 'steady-state-error/unstable-loop',
      skillId: 'steady-state-error',
      difficulty: 4,
      kind: 'mcq',
      prompt: 'Unity feedback around G(s) = 4/(s²(s + 2)). What is the steady-state error to a unit step?',
      choices: [
        'Undefined: the closed loop is unstable',
        '0, because the loop is type 2',
        '0.5',
        '1/(1 + 4)',
      ],
      answer: 0,
      explanation:
        'The characteristic polynomial s³ + 2s² + 4 has no s term, so the loop is unstable. Error constants only apply to a stable loop.',
    },
  ],
  generators: [
    defineGenerator({
      id: 'system-type',
      skillId: 'system-type',
      difficulties: [1, 2, 3],
      generate(rng, d) {
        const a = int(rng, 1, 6);
        const b = int(rng, a + 1, 9);
        const k = pick(rng, [2, 3, 4, 5, 10, 20]);
        if (d === 1) {
          const n = int(rng, 0, 3);
          const den = n === 0 ? `(s + ${a})(s + ${b})` : `${sPow(n)}(s + ${a})(s + ${b})`;
          return {
            skillId: 'system-type',
            difficulty: d,
            kind: 'mcq',
            prompt: `What is the system type of G(s) = ${k}/(${den})?`,
            choices: TYPE_CHOICES,
            answer: n,
            explanation: `Count the poles at s = 0: ${n === 0 ? 'there are none' : `${sPow(n)} gives ${n}`}, so the loop is type ${n}.`,
          };
        }
        if (d === 2) {
          // Factored, with jω-axis poles or a zero at the origin as traps.
          const n = int(rng, 1, 3);
          const w2 = pick(rng, [1, 4, 9, 16]);
          if (chance(rng, 0.5)) {
            const m = int(rng, 1, n);
            const num = `${k}${sPow(m)}(s + ${a})`;
            return {
              skillId: 'system-type',
              difficulty: d,
              kind: 'mcq',
              prompt: `What is the system type of G(s) = ${num}/(${sPow(n)}(s + ${b})(s² + ${w2}))?`,
              choices: TYPE_CHOICES,
              answer: n - m,
              explanation: `${sPow(m)} in the numerator cancels ${m} of the ${n} origin poles, and s² + ${w2} has roots at ±${nice(Math.sqrt(w2))}j, not 0: type ${n - m}.`,
            };
          }
          return {
            skillId: 'system-type',
            difficulty: d,
            kind: 'mcq',
            prompt: `What is the system type of G(s) = ${k}(s + ${a})/(${sPow(n)}(s + ${b})(s² + ${w2}))?`,
            choices: TYPE_CHOICES,
            answer: n,
            explanation: `Only poles exactly at s = 0 count: ${sPow(n)} gives ${n}. The ±${nice(Math.sqrt(w2))}j poles of s² + ${w2} are not integrators: type ${n}.`,
          };
        }
        // d3: fully expanded denominator; the solver has to factor out powers of s.
        const n = int(rng, 0, 3);
        const coeffs = mul(mul([1, a], [1, b]), [1, ...new Array<number>(n).fill(0)]);
        const c = int(rng, 1, 9);
        return {
          skillId: 'system-type',
          difficulty: d,
          kind: 'mcq',
          prompt: `What is the system type of G(s) = ${k}(s + ${c})/(${poly(coeffs)})?`,
          choices: TYPE_CHOICES,
          answer: n,
          explanation: `Factor the denominator: ${n === 0 ? '' : sPow(n)}(s + ${a})(s + ${b}). ${n === 0 ? 'No factor of s' : `${n} factor${n > 1 ? 's' : ''} of s`}, so type ${n}.`,
        };
      },
    }),
    defineGenerator({
      id: 'ss-error-step',
      skillId: 'steady-state-error',
      difficulties: [1, 2, 3],
      generate(rng, d) {
        const kp = pick(rng, [1, 3, 4, 7, 9, 19, 24, 49]);
        const a = int(rng, 1, 5);
        if (d === 1) {
          const k = kp * a;
          return {
            skillId: 'steady-state-error',
            difficulty: d,
            kind: 'numeric',
            prompt: `Unity feedback around G(s) = ${k}/(s + ${a}). What is the steady-state error to a unit step?`,
            answer: 1 / (1 + kp),
            tolerance: {},
            explanation: `Kp = G(0) = ${k}/${a} = ${kp}, so e(∞) = 1/(1 + Kp) = 1/${1 + kp} = ${nice(1 / (1 + kp))}.`,
          };
        }
        const b = int(rng, a + 1, 8);
        if (d === 2) {
          const k = kp * a * b;
          return {
            skillId: 'steady-state-error',
            difficulty: d,
            kind: 'numeric',
            prompt: `Unity feedback around G(s) = ${k}/((s + ${a})(s + ${b})). What is the steady-state error to a unit step?`,
            answer: 1 / (1 + kp),
            tolerance: {},
            explanation: `Kp = G(0) = ${k}/(${a}·${b}) = ${kp}, so e(∞) = 1/(1 + Kp) = ${nice(1 / (1 + kp))}.`,
          };
        }
        // d3: a zero in G (never cancelling a pole) and a step of height R.
        // Poles at −(a + 1), −(b + 1) are ≥ 2, so c = 1 is always a valid zero.
        const [p1, p2] = [a + 1, b + 1];
        const r = pick(rng, [2, 5, 10]);
        const cands = [1, 2, 3, 4, 5, 6, 10].filter((c) => (kp * p1 * p2) % c === 0 && c !== p1 && c !== p2);
        const c = pick(rng, cands);
        const k = (kp * p1 * p2) / c;
        const e = r / (1 + kp);
        return {
          skillId: 'steady-state-error',
          difficulty: d,
          kind: 'numeric',
          prompt: `Unity feedback around G(s) = ${k}(s + ${c})/((s + ${p1})(s + ${p2})). The reference is a step of height ${r}. What is the steady-state error?`,
          answer: e,
          tolerance: {},
          explanation: `Kp = G(0) = ${k}·${c}/(${p1}·${p2}) = ${kp}, and the error scales with the step: e = ${r}/(1 + ${kp}) = ${nice(e)}.`,
        };
      },
    }),
    defineGenerator({
      id: 'ss-error-ramp',
      skillId: 'steady-state-error',
      difficulties: [2, 3, 4],
      generate(rng, d) {
        const kv = pick(rng, [0.5, 1, 2, 4, 5, 10, 20]);
        if (d === 2) {
          const a = pick(rng, [2, 4, 6, 8, 10]);
          const k = kv * a;
          return {
            skillId: 'steady-state-error',
            difficulty: d,
            kind: 'numeric',
            prompt: `Unity feedback around G(s) = ${nice(k)}/(s(s + ${a})). What is the steady-state error to a unit ramp?`,
            answer: 1 / kv,
            tolerance: {},
            explanation: `Kv = lim s→0 s·G(s) = ${nice(k)}/${a} = ${nice(kv)}, so e(∞) = 1/Kv = ${nice(1 / kv)}.`,
          };
        }
        // Third-order loop with a zero: pick until the closed loop is stable (Routh: (a+b)(ab+K) > K·c).
        // Fallback (always integer and stable): a = 2, b = 4, c = 1.
        let [a, b, c, k] = [2, 4, 1, kv * 8];
        for (let tries = 0; tries < 50; tries++) {
          const ta = int(rng, 1, 5);
          const tb = int(rng, ta + 1, 8);
          const tc = int(rng, 1, 6);
          const tk = (kv * ta * tb) / tc;
          if (Number.isInteger(tk) && tc !== ta && tc !== tb && (ta + tb) * (ta * tb + tk) > tk * tc) {
            [a, b, c, k] = [ta, tb, tc, tk];
            break;
          }
        }
        const r = d === 4 ? pick(rng, [2, 3, 5]) : 1;
        const e = r / kv;
        const input = r === 1 ? 'a unit ramp' : `the ramp r(t) = ${r}t`;
        return {
          skillId: 'steady-state-error',
          difficulty: d,
          kind: 'numeric',
          prompt: `Unity feedback around G(s) = ${nice(k)}(s + ${c})/(s(s + ${a})(s + ${b})) (stable). What is the steady-state error to ${input}?`,
          answer: e,
          tolerance: {},
          explanation: `Kv = lim s→0 s·G(s) = ${nice(k)}·${c}/(${a}·${b}) = ${nice(kv)}, so e(∞) = ${r === 1 ? '1' : r}/Kv = ${nice(e)}.`,
        };
      },
    }),
  ],
});
