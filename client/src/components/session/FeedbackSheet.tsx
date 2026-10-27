import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import type { AnswerResult } from '@/api/types';
import { CheckGlyph, CrossGlyph } from '@/components/questions/OptionCard';
import { Button, HeartGlyph, Text } from '@/components/ui';
import { borders, layout, palette, radii, spacing } from '@/theme/tokens';

import { ComboBadge } from './ComboBadge';

export type FeedbackSheetProps = {
  result: Pick<AnswerResult, 'correct' | 'correctAnswerText' | 'explanation' | 'combo' | 'comboBonusXp'>;
  onContinue: () => void;
  /** Show the "−1 heart" note on a miss (lessons only). */
  costsHeart?: boolean;
  /** Continue is busy (e.g. saving the session after the last answer). */
  busy?: boolean;
};

const PRAISE = ['Nice!', 'Nailed it!', 'Clean settle!', 'Locked in!'];

/**
 * Bottom sheet after Check. Green for correct, red for a miss, with the right answer,
 * a short explanation, the combo flame and a Continue button. Slides up with a spring.
 */
export function FeedbackSheet({ result, onContinue, costsHeart = false, busy = false }: FeedbackSheetProps) {
  const { correct } = result;
  const tone = correct ? palette.success : palette.error;
  const enter = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const a = Animated.spring(enter, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [enter]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [48, 0] });
  const title = correct ? PRAISE[result.combo % PRAISE.length] : 'Not quite';

  return (
    <Animated.View
      testID="feedback-sheet"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.sheet, { backgroundColor: tone.tint, borderTopColor: tone.base, transform: [{ translateY }] }]}
    >
      <View style={styles.column}>
        <View style={styles.titleRow}>
          <View style={[styles.mark, { backgroundColor: tone.base, borderColor: tone.shade }]}>
            {correct ? <CheckGlyph color={tone.on} size={24} /> : <CrossGlyph color={tone.on} size={24} />}
          </View>
          <Text variant="title" style={{ color: tone.shade }} testID="feedback-title">
            {title}
          </Text>
          {correct ? (
            <View style={styles.badge}>
              <ComboBadge combo={result.combo} bonusXp={result.comboBonusXp} />
            </View>
          ) : costsHeart ? (
            <View style={styles.heartLoss} accessible accessibilityLabel="You lost a heart">
              <HeartGlyph size={20} />
              <Text variant="monoStrong" style={{ color: palette.heart.shade }}>
                −1
              </Text>
            </View>
          ) : null}
        </View>

        {!correct ? (
          <View style={styles.answer}>
            <Text variant="label" style={{ color: tone.shade }}>
              Correct answer
            </Text>
            <Text variant="monoStrong" style={[styles.answerText, { color: tone.shade }]} testID="feedback-correct-answer">
              {result.correctAnswerText}
            </Text>
          </View>
        ) : null}

        {result.explanation ? (
          <Text variant="body" style={styles.explanation} testID="feedback-explanation">
            {result.explanation}
          </Text>
        ) : null}

        <Button label="Continue" variant={correct ? 'success' : 'danger'} onPress={onContinue} loading={busy} testID="continue-button" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopWidth: borders.width,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  column: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
    gap: spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  mark: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderBottomWidth: borders.edge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { marginLeft: 'auto' },
  heartLoss: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  answer: { gap: spacing.xs },
  answerText: { fontSize: 17, lineHeight: 24 },
  explanation: { marginBottom: spacing.xs },
});
