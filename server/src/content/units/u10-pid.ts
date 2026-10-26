/**
 * Content pack D, U10: PID control.
 */
import { defineUnit, round } from '../authoring.ts';

/** Sample a closed-form step response y(t) at the given times, rounded to 3 dp. */
function curve(y: (t: number) => number, ts: readonly number[]): [number, number][] {
  return ts.map((t) => [t, round(y(t), 3)]);
}

const T = [0, 0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 1, 1.25, 1.5];

// Plant 1/(s + 1), unity feedback.
// P control, Kp = 4: T(s) = 4/(s + 5), y(t) = 0.8(1 − e^(−5t)), settles at 0.8.
const P_ONLY = curve((t) => 0.8 * (1 - Math.exp(-5 * t)), T);
// PI control, C(s) = 4(s + 1)/s (zero cancels the plant pole): T(s) = 4/(s + 4), y(t) = 1 − e^(−4t).
const PI_CTRL = curve((t) => 1 - Math.exp(-4 * t), T);

export default defineUnit({
  unitId: 'u10',
  items: [
    {
      id: 'pid-control/term-roles',
      skillId: 'pid-control',
      difficulty: 1,
      kind: 'match',
      prompt: 'Match each PID term to what it responds to.',
      left: ['P (Kp·e)', 'I (Ki·∫e dt)', 'D (Kd·de/dt)'],
      right: ['The present error', 'The accumulated past error', 'The rate of change of the error (a prediction)'],
      answer: [0, 1, 2],
      explanation:
        'P scales the current error, I integrates the error history, and D reacts to how fast the error is changing, anticipating where it is heading.',
    },
    {
      id: 'pid-control/gain-effects',
      skillId: 'pid-control',
      difficulty: 2,
      kind: 'match',
      prompt: 'Typical effect of increasing each gain on the step response of a stable loop (type-0 plant):',
      left: ['Raise Kp', 'Raise Ki', 'Raise Kd'],
      right: [
        'Faster rise and smaller (but nonzero) steady-state error, more overshoot',
        'Steady-state error removed faster, but more overshoot and less stability margin',
        'Less overshoot and more damping, but amplifies measurement noise',
      ],
      answer: [0, 1, 2],
      explanation:
        'Kp trades speed for overshoot, Ki drives the steady-state error to zero at the cost of phase lag, and Kd adds damping (phase lead) but has high gain at high frequency.',
    },
    {
      id: 'pid-control/integrator-pole',
      skillId: 'pid-control',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'C(s) = Kp + Ki/s + Kd·s. Which term adds a pole at s = 0 to the loop?',
      choices: ['The integral term Ki/s', 'The proportional term Kp', 'The derivative term Kd·s', 'None of them'],
      answer: 0,
      explanation: 'Ki/s is a pure integrator, a pole at the origin; it raises the system type by one, which is why I action removes step error.',
    },
    {
      id: 'pid-control/p-only-offset',
      skillId: 'pid-control',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'With pure P control (finite Kp) of a type-0 plant in unity feedback, a step reference always leaves a nonzero steady-state error.',
      answer: true,
      explanation: 'The step error is 1/(1 + Kp·G(0)), which is nonzero for any finite gain; only an integrator drives it to zero.',
    },
    {
      id: 'pid-control/p-ss-error',
      skillId: 'pid-control',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'Plant G(s) = 2/(s + 1) under unity feedback with P control Kp = 4. What is the steady-state error to a unit step?',
      answer: 1 / 9,
      tolerance: { abs: 0.005 },
      explanation: 'G(0) = 2, so the position constant is Kp·G(0) = 8 and e = 1/(1 + 8) = 1/9 ≈ 0.111.',
    },
    {
      id: 'pid-control/which-controller-p',
      skillId: 'pid-control',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'Plant 1/(s + 1), unity feedback, unit step reference. The closed-loop response shown settles at 0.8. Which controller produced it?',
      figure: { type: 'step_response', points: P_ONLY, finalValue: 0.8, xLabel: 't (s)', yLabel: 'y' },
      choices: ['P control, Kp = 4', 'PI control, Kp = 4, Ki = 4', 'P control, Kp = 0.8', 'PI control, Kp = 0.8, Ki = 1'],
      answer: 0,
      explanation:
        'Any PI controller would settle at exactly 1. With P control the final value is Kp/(1 + Kp) = 0.8, so Kp = 4 (and the pole moves to s = −5).',
    },
    {
      id: 'pid-control/which-controller-pi',
      skillId: 'pid-control',
      difficulty: 2,
      kind: 'true_false',
      prompt: 'Plant 1/(s + 1), unity feedback. The step response shown settles at exactly 1. True or false: a pure P controller with large enough finite Kp can produce this.',
      figure: { type: 'step_response', points: PI_CTRL, finalValue: 1, xLabel: 't (s)', yLabel: 'y' },
      answer: false,
      explanation:
        'P control gives a final value of Kp/(1 + Kp) < 1 for every finite Kp. Zero error needs integral action, e.g. PI C(s) = 4(s + 1)/s, which gives exactly this curve.',
    },
    {
      id: 'pid-control/pi-zero',
      skillId: 'pid-control',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'A PI controller C(s) = 2 + 6/s. Where is its zero (the value of s)?',
      answer: -3,
      tolerance: { abs: 0.01 },
      explanation: 'C(s) = (2s + 6)/s = 2(s + 3)/s, so the PI adds a pole at 0 and a zero at s = −Ki/Kp = −3.',
    },
    {
      id: 'pid-control/pi-ramp-error',
      skillId: 'pid-control',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'A stable type-0 plant gets a PI controller (unity feedback, closed loop stable). The steady-state error to a unit ramp is:',
      choices: ['Finite and nonzero', 'Zero', 'Infinite', 'Determined only by Kd'],
      answer: 0,
      explanation: 'The integrator makes the loop type 1: step error becomes zero, and ramp error becomes a finite 1/Kv with Kv = Ki·G(0).',
    },
    {
      id: 'pid-control/derivative-drawbacks',
      skillId: 'pid-control',
      difficulty: 3,
      kind: 'multi_select',
      prompt: 'Which are genuine practical issues with derivative action? Select all that apply.',
      choices: [
        'It amplifies high-frequency measurement noise',
        'A setpoint step causes a large "derivative kick" if D acts on the error',
        'The ideal Kd·s is improper, so it is implemented with a low-pass filter',
        'It reintroduces steady-state error to a step',
        'It adds a pole at the origin',
      ],
      answer: [0, 1, 2],
      explanation:
        'Kd·s has gain growing with ω, so noise is amplified, steps produce impulses, and a filter Kd·s/(τf·s + 1) is used. D does not change steady-state error or add an integrator.',
    },
    {
      id: 'pid-control/windup',
      skillId: 'pid-control',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'What is integrator windup?',
      choices: [
        'While the actuator is saturated, the integral keeps growing, causing large overshoot and slow recovery',
        'Numerical drift of the integral caused by sensor noise averaging to zero',
        'The integrator making the closed loop unstable for any Ki > 0',
        'The derivative term spiking when the setpoint changes',
      ],
      answer: 0,
      explanation:
        'During saturation the loop is effectively open, so the integrator accumulates error it cannot act on; anti-windup (clamping or back-calculation) stops it.',
    },
    {
      id: 'pid-control/pd-double-integrator',
      skillId: 'pid-control',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'Plant 1/s² with PD control C(s) = Kp + Kd·s, unity feedback. Which Kd gives closed-loop ωn = 4 rad/s and ζ = 0.5?',
      answer: 4,
      tolerance: {},
      explanation: 'The characteristic polynomial is s² + Kd·s + Kp, so Kp = ωn² = 16 and Kd = 2ζωn = 2·0.5·4 = 4.',
    },
    {
      id: 'pid-control/ziegler-nichols',
      skillId: 'pid-control',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'A loop oscillates steadily under P control at Ku = 10 with period Tu = 2 s. Classic Ziegler–Nichols PID uses Kp = 0.6·Ku, Ti = Tu/2, Td = Tu/8. What is Kp?',
      answer: 6,
      tolerance: {},
      explanation: 'Kp = 0.6·10 = 6 (with Ti = 1 s and Td = 0.25 s). These rules give a quick, fairly aggressive starting point to refine.',
    },
    {
      id: 'pid-control/pi-type-two',
      skillId: 'pid-control',
      difficulty: 4,
      kind: 'true_false',
      prompt: 'Plant G(s) = 1/(s(s + 1)). Adding a PI controller (closed loop stable) makes the steady-state error to a ramp zero.',
      answer: true,
      explanation: 'The plant already has one integrator; PI adds a second, making the loop type 2, which tracks ramps with zero steady-state error.',
    },
    {
      id: 'pid-control/d-filter-gain',
      skillId: 'pid-control',
      difficulty: 5,
      kind: 'numeric',
      prompt: 'A filtered derivative term is Kd·s/(τf·s + 1) with Kd = 0.5 and τf = 0.01 s. What is its gain magnitude as ω → ∞?',
      answer: 50,
      tolerance: {},
      explanation: 'For large s the term tends to Kd/τf = 0.5/0.01 = 50, so the filter caps the noise gain instead of letting it grow without bound.',
    },
    {
      id: 'pid-control/pid-tradeoffs',
      skillId: 'pid-control',
      difficulty: 5,
      kind: 'multi_select',
      prompt: 'A PI loop on a stable plant overshoots too much. Which changes typically reduce overshoot? Select all that apply.',
      choices: ['Add derivative action', 'Reduce Ki', 'Increase Ki', 'Add an anti-windup scheme if the actuator saturates'],
      answer: [0, 1, 3],
      explanation:
        'D adds damping and less Ki means less integrator phase lag; windup also causes overshoot after saturation. More Ki generally increases overshoot.',
    },
  ],
  generators: [],
});
