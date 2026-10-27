import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MultiSelectResponse } from '@/api/types';
import { spacing } from '@/theme/tokens';

import { OptionCard, type OptionState } from './OptionCard';
import type { InputProps } from './types';
import { useKeyShortcuts } from './useKeyShortcuts';

export type MultiSelectInputProps = InputProps<MultiSelectResponse, number[]> & {
  choices: string[];
  initial?: number[];
};

/**
 * Select all that apply. Emits `{ choices }` (sorted indices) or `null` when nothing is selected,
 * since submitting an empty selection is almost always an accidental Check.
 */
export function MultiSelectInput({ choices, initial = [], onChange, disabled, reveal, shortcuts = true, testID }: MultiSelectInputProps) {
  const [picked, setPicked] = useState<number[]>(initial);
  const locked = !!disabled || !!reveal;

  const toggle = (i: number) => {
    if (locked) return;
    const next = picked.includes(i) ? picked.filter((p) => p !== i) : [...picked, i].sort((a, b) => a - b);
    setPicked(next);
    onChange(next.length ? { choices: next } : null);
  };

  useKeyShortcuts(Object.fromEntries(choices.map((_, i) => [String(i + 1), () => toggle(i)])), shortcuts && !locked);

  const stateOf = (i: number): OptionState => {
    const on = picked.includes(i);
    if (reveal) {
      const right = reveal.correctAnswer.includes(i);
      if (right) return on ? 'correct' : 'missed';
      return on ? 'incorrect' : 'dimmed';
    }
    return on ? 'selected' : 'idle';
  };

  return (
    <View style={styles.list} testID={testID}>
      {choices.map((c, i) => (
        <OptionCard
          key={`${i}-${c}`}
          testID={`multi-option-${i}`}
          label={c}
          checkbox
          state={stateOf(i)}
          onPress={() => toggle(i)}
          disabled={locked}
          accessibilityRole="checkbox"
          checked={picked.includes(i)}
          accessibilityHint={reveal && stateOf(i) === 'missed' ? 'This was also correct' : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
