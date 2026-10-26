import { BodeMag } from './BodeMag';
import { PoleZeroMap } from './PoleZeroMap';
import { StepResponse } from './StepResponse';
import type { FigureSpec } from './types';

export type FigureProps = {
  figure: FigureSpec | null | undefined;
  testID?: string;
};

/** Renders a question's figure. Unknown or missing figure types render nothing. */
export function Figure({ figure, testID }: FigureProps) {
  if (!figure || typeof figure !== 'object') return null;
  switch (figure.type) {
    case 'pole_zero':
      return <PoleZeroMap poles={figure.poles ?? []} zeros={figure.zeros ?? []} testID={testID} />;
    case 'step_response':
      return (
        <StepResponse
          points={figure.points ?? []}
          finalValue={figure.finalValue}
          xLabel={figure.xLabel}
          yLabel={figure.yLabel}
          testID={testID}
        />
      );
    case 'bode_mag':
      return <BodeMag points={figure.points ?? []} asymptotes={figure.asymptotes} testID={testID} />;
    default:
      // Forward-compatible: a newer server may send figure types this client doesn't know.
      return null;
  }
}
