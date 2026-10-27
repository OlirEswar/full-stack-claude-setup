import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ClientQuestion } from '@/api/types';
import {
  MatchInput,
  McqInput,
  MultiSelectInput,
  NumericInput,
  QuestionView,
  TrueFalseInput,
  isMathy,
  parseNumeric,
} from '@/components/questions';

const base: Omit<ClientQuestion, 'kind' | 'prompt'> = {
  itemId: 7,
  position: 1,
  total: 10,
  skillId: 'second-order',
  difficulty: 2,
};

const lastCall = (fn: jest.Mock) => fn.mock.calls[fn.mock.calls.length - 1]?.[0];

describe('question inputs', () => {
  it('McqInput emits {choice} for tapped option', async () => {
    const onChange = jest.fn();
    await render(<McqInput choices={['ζ = 0.2', 'ζ = 0.7', 'ζ = 1.0']} onChange={onChange} />);
    await fireEvent.press(screen.getByText('ζ = 0.7'));
    expect(onChange).toHaveBeenLastCalledWith({ choice: 1 });
    expect(screen.getByTestId('mcq-option-1').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('McqInput is frozen when disabled and highlights the key on reveal', async () => {
    const onChange = jest.fn();
    const r = await render(<McqInput choices={['A', 'B', 'C']} onChange={onChange} initial={0} reveal={{ correct: false, correctAnswer: 2 }} />);
    await fireEvent.press(screen.getByText('B'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('result-correct')).toBeTruthy();
    expect(screen.getByTestId('result-incorrect')).toBeTruthy();
    r.unmount();
  });

  it('TrueFalseInput emits {value:false}', async () => {
    const onChange = jest.fn();
    await render(<TrueFalseInput onChange={onChange} />);
    await fireEvent.press(screen.getByText('False'));
    expect(onChange).toHaveBeenLastCalledWith({ value: false });
    await fireEvent.press(screen.getByText('True'));
    expect(onChange).toHaveBeenLastCalledWith({ value: true });
  });

  it('NumericInput emits null for invalid text and {value} for "0.707"', async () => {
    const onChange = jest.fn();
    await render(<NumericInput unit="rad/s" onChange={onChange} />);
    const field = screen.getByTestId('numeric-field');
    await fireEvent.changeText(field, '0.7.0');
    expect(lastCall(onChange)).toBeNull();
    await fireEvent.changeText(field, 'abc');
    expect(lastCall(onChange)).toBeNull();
    await fireEvent.changeText(field, '0.707');
    expect(lastCall(onChange)).toEqual({ value: 0.707 });
    expect(screen.getByText('rad/s')).toBeTruthy();
  });

  it('NumericInput sign and exponent helper keys', async () => {
    const onChange = jest.fn();
    await render(<NumericInput onChange={onChange} />);
    await fireEvent.changeText(screen.getByTestId('numeric-field'), '2.5');
    await fireEvent.press(screen.getByTestId('numeric-sign'));
    expect(lastCall(onChange)).toEqual({ value: -2.5 });
    await fireEvent.press(screen.getByTestId('numeric-exp'));
    expect(lastCall(onChange)).toBeNull(); // "-2.5e" is incomplete
    await fireEvent.changeText(screen.getByTestId('numeric-field'), '-2.5e-3');
    expect(lastCall(onChange)).toEqual({ value: -0.0025 });
  });

  it('parseNumeric accepts minus variants, comma decimals and e-notation', () => {
    expect(parseNumeric('0.707')).toBe(0.707);
    expect(parseNumeric('−1.5')).toBe(-1.5);
    expect(parseNumeric(' -3 ')).toBe(-3);
    expect(parseNumeric('0,5')).toBe(0.5);
    expect(parseNumeric('.5')).toBe(0.5);
    expect(parseNumeric('5.')).toBe(5);
    expect(parseNumeric('2E3')).toBe(2000);
    expect(parseNumeric('1e−2')).toBe(0.01);
    for (const bad of ['', '-', '.', 'e3', '1e', '1,000.5', '1,0,0', '1/2', 'Infinity', 'NaN', '0x10', '1e999']) {
      expect(parseNumeric(bad)).toBeNull();
    }
  });

  it('MultiSelectInput toggles selections into {choices}', async () => {
    const onChange = jest.fn();
    await render(<MultiSelectInput choices={['Overshoot', 'Rise time', 'Steady-state error', 'Bandwidth']} onChange={onChange} />);
    await fireEvent.press(screen.getByText('Steady-state error'));
    expect(onChange).toHaveBeenLastCalledWith({ choices: [2] });
    await fireEvent.press(screen.getByText('Overshoot'));
    expect(onChange).toHaveBeenLastCalledWith({ choices: [0, 2] });
    await fireEvent.press(screen.getByText('Steady-state error'));
    expect(onChange).toHaveBeenLastCalledWith({ choices: [0] });
    await fireEvent.press(screen.getByText('Overshoot'));
    expect(lastCall(onChange)).toBeNull();
  });

  it('MatchInput emits {pairs} only when all left items are paired', async () => {
    const onChange = jest.fn();
    await render(
      <MatchInput left={['ζ = 0', 'ζ = 1', 'ζ > 1']} right={['Overdamped', 'Undamped', 'Critically damped']} onChange={onChange} />,
    );
    await fireEvent.press(screen.getByText('ζ = 0'));
    await fireEvent.press(screen.getByText('Undamped'));
    expect(lastCall(onChange)).toBeNull();
    // Selection auto-advances to the next unpaired left item ("ζ = 1").
    await fireEvent.press(screen.getByText('Critically damped'));
    expect(lastCall(onChange)).toBeNull();
    expect(screen.getAllByTestId('pair-chip-1')).toHaveLength(2); // chip on both left and right item
    await fireEvent.press(screen.getByText('ζ > 1'));
    await fireEvent.press(screen.getByText('Overdamped'));
    expect(lastCall(onChange)).toEqual({ pairs: [1, 2, 0] });

    // Re-pairing: tapping a matched right item with nothing selected unpairs it.
    await fireEvent.press(screen.getByText('Overdamped'));
    expect(lastCall(onChange)).toBeNull();
    // ...and re-selects its left item, so the next right tap pairs it again.
    await fireEvent.press(screen.getByText('Undamped'));
    expect(lastCall(onChange)).toBeNull(); // "Undamped" moved from ζ = 0 to ζ > 1
    await fireEvent.press(screen.getByText('Overdamped'));
    expect(lastCall(onChange)).toEqual({ pairs: [0, 2, 1] });
  });

  it('QuestionView renders figure when present', async () => {
    const onChange = jest.fn();
    const q: ClientQuestion = {
      ...base,
      kind: 'mcq',
      prompt: 'Estimate the percent overshoot of this step response.',
      choices: ['≈ 5%', '≈ 25%', '≈ 50%'],
      figure: { type: 'step_response', points: [[0, 0], [1, 1.25], [2, 0.95], [3, 1]], finalValue: 1 },
    };
    const { rerender } = await render(<QuestionView question={q} onChange={onChange} />);
    expect(screen.getByTestId('question-figure')).toBeTruthy();
    expect(screen.getByText(q.prompt)).toBeTruthy();
    expect(screen.getByText('Choose one')).toBeTruthy();
    await fireEvent.press(screen.getByText('≈ 25%'));
    expect(onChange).toHaveBeenLastCalledWith({ choice: 1 });

    await rerender(<QuestionView question={{ ...q, itemId: 8, figure: undefined }} onChange={onChange} />);
    expect(screen.queryByTestId('question-figure')).toBeNull();
  });

  it('QuestionView picks the input for each kind and locks on reveal', async () => {
    const onChange = jest.fn();
    const q: ClientQuestion = { ...base, kind: 'numeric', prompt: 'Find ωn for s² + 2s + 4.', unit: 'rad/s' };
    const { rerender } = await render(<QuestionView question={q} onChange={onChange} />);
    expect(screen.getByTestId('numeric-field')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('numeric-field'), '2');
    expect(onChange).toHaveBeenLastCalledWith({ value: 2 });

    await rerender(<QuestionView question={q} onChange={onChange} reveal={{ correct: true, correctAnswer: 2 }} />);
    expect(screen.getByTestId('numeric-field').props.editable).toBe(false);
    expect(screen.getByTestId('result-correct')).toBeTruthy();

    await rerender(<QuestionView question={{ ...base, itemId: 9, kind: 'true_false', prompt: 'A pole at s = 1 is stable.' }} onChange={onChange} />);
    await fireEvent.press(screen.getByText('False'));
    expect(onChange).toHaveBeenLastCalledWith({ value: false });

    await rerender(<QuestionView question={{ ...base, itemId: 10, kind: 'mcq', prompt: 'Broken' }} onChange={onChange} />);
    expect(screen.getByText('This question is incomplete')).toBeTruthy();
  });

  it('isMathy routes expressions to the mono face', () => {
    expect(isMathy('s = −2 ± j3')).toBe(true);
    expect(isMathy('0.707')).toBe(true);
    expect(isMathy('Increase the gain')).toBe(false);
  });
});
