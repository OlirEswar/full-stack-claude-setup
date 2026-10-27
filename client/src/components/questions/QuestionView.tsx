import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AnswerResult, ClientQuestion, QuestionKind, QuestionResponse } from '@/api/types';
import { Figure } from '@/components/figures';
import { ErrorState, Text } from '@/components/ui';
import { spacing } from '@/theme/tokens';

import { MatchInput } from './MatchInput';
import { McqInput } from './McqInput';
import { MultiSelectInput } from './MultiSelectInput';
import { NumericInput } from './NumericInput';
import { TrueFalseInput } from './TrueFalseInput';
import type { Reveal } from './types';

export type QuestionReveal = Reveal<AnswerResult['correctAnswer']>;

export type QuestionViewProps = {
  question: ClientQuestion;
  /** Current answer, or null while the question isn't answerable yet (Check stays disabled). */
  onChange: (response: QuestionResponse | null) => void;
  /** Freeze inputs (e.g. while the answer is being checked). */
  disabled?: boolean;
  /** Feedback state after Check: freezes inputs and highlights right/wrong. */
  reveal?: QuestionReveal;
  testID?: string;
};

export const KIND_EYEBROW: Record<QuestionKind, string> = {
  mcq: 'Choose one',
  true_false: 'True or false?',
  numeric: 'Enter a value',
  multi_select: 'Select all that apply',
  match: 'Match the pairs',
};

/**
 * Narrow the server's union-typed answer key to what each input expects. A mismatched key drops the
 * highlight (the input still stays locked, see `common.disabled`).
 */
function revealAs<A>(reveal: QuestionReveal | undefined, ok: (v: unknown) => v is A): Reveal<A> | undefined {
  if (!reveal || !ok(reveal.correctAnswer)) return undefined;
  return { correct: reveal.correct, correctAnswer: reveal.correctAnswer };
}
const isNum = (v: unknown): v is number => typeof v === 'number';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isNums = (v: unknown): v is number[] => Array.isArray(v) && v.every(isNum);

/**
 * One question: eyebrow + prompt, optional figure, and the input for its kind.
 * Inputs are keyed by `itemId`, so a new question always starts blank.
 */
export function QuestionView({ question: q, onChange, disabled, reveal, testID }: QuestionViewProps) {
  const common = { onChange, disabled: !!disabled || !!reveal };
  const k = q.itemId;
  const broken = (what: string) => (
    <ErrorState title="This question is incomplete" message={`It arrived without its ${what}. Skip ahead or try again later.`} />
  );

  let input: ReactNode;
  switch (q.kind) {
    case 'mcq':
      input = q.choices?.length ? <McqInput key={k} {...common} choices={q.choices} reveal={revealAs(reveal, isNum)} /> : broken('options');
      break;
    case 'true_false':
      input = <TrueFalseInput key={k} {...common} reveal={revealAs(reveal, isBool)} />;
      break;
    case 'numeric':
      input = <NumericInput key={k} {...common} unit={q.unit} reveal={revealAs(reveal, isNum)} />;
      break;
    case 'multi_select':
      input = q.choices?.length ? (
        <MultiSelectInput key={k} {...common} choices={q.choices} reveal={revealAs(reveal, isNums)} />
      ) : (
        broken('options')
      );
      break;
    case 'match':
      input =
        q.left?.length && q.right?.length ? (
          <MatchInput key={k} {...common} left={q.left} right={q.right} reveal={revealAs(reveal, isNums)} />
        ) : (
          broken('match items')
        );
      break;
    default:
      input = broken('answer format');
  }

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.head}>
        <Text variant="label" tone="primary">
          {KIND_EYEBROW[q.kind] ?? 'Question'}
        </Text>
        <Text variant="heading" style={styles.prompt} accessibilityRole="header" testID="question-prompt">
          {q.prompt}
        </Text>
      </View>
      {q.figure ? (
        <View style={styles.figure}>
          <Figure figure={q.figure} testID="question-figure" />
        </View>
      ) : null}
      <View style={styles.input}>{input}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  head: { gap: spacing.sm },
  // Unicode math (ω, ζ, superscripts, fractions) needs extra leading to avoid clipping.
  prompt: { lineHeight: 30 },
  figure: { alignSelf: 'stretch' },
  input: { alignSelf: 'stretch' },
});
