/**
 * Figure specs as sent by the server. Mirrors `FigureSpec` in
 * `server/src/content/types.ts` exactly; keep the two in sync.
 */
export type Complex = { re: number; im: number };

export type PoleZeroFigure = { type: 'pole_zero'; poles: Complex[]; zeros: Complex[] };

export type StepResponseFigure = {
  type: 'step_response';
  points: [number, number][];
  finalValue?: number;
  xLabel?: string;
  yLabel?: string;
};

export type BodeMagFigure = {
  type: 'bode_mag';
  /** [ω rad/s, dB], ω log-spaced */
  points: [number, number][];
  asymptotes?: [number, number][];
};

export type FigureSpec = PoleZeroFigure | StepResponseFigure | BodeMagFigure;
