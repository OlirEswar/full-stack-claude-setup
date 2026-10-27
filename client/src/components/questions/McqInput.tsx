import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { McqResponse } from '@/api/types';
import { spacing } from '@/theme/tokens';

import { OptionCard, type OptionState } from './OptionCard';
import type { InputProps } from './types';
import { useKeyShortcuts } from './useKeyShortcuts';

export type McqInputProps = InputProps<McqResponse, number> & {
  choices: string[];
  initial?: number | null;
};

/** Single choice. Emits `{ choice }` (index into the displayed, server-shuffled choices). */
export function McqInput({ choices, initial = null, onChange, disabled, reveal, shortcuts = true, testID }: McqInputProps) {
  const [picked, setPicked] = useState<number | null>(initial);
  const locked = !!disabled || !!reveal;

  const pick = (i: number) => {
    if (locked) return;
    setPicked(i);
    onChange({ choice: i });
  };

  useKeyShortcuts(Object.fromEntries(choices.map((_, i) => [String(i + 1), () => pick(i)])), shortcuts && !locked);

  const stateOf = (i: number): OptionState => {
    if (reveal) {
      if (i === reveal.correctAnswer) return 'correct';
      if (i === picked) return 'incorrect';
      return 'dimmed';
    }
    return i === picked ? 'selected' : 'idle';
  };

  return (
    <View style={styles.list} accessibilityRole="radiogroup" testID={testID}>
      {choices.map((c, i) => (
        <OptionCard
          key={`${i}-${c}`}
          testID={`mcq-option-${i}`}
          label={c}
          badge={String(i + 1)}
          state={stateOf(i)}
          onPress={() => pick(i)}
          disabled={locked}
          accessibilityRole="radio"
          checked={picked === i}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
