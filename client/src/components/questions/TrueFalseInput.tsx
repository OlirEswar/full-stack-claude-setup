import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TrueFalseResponse } from '@/api/types';
import { spacing } from '@/theme/tokens';

import { OptionCard, type OptionState } from './OptionCard';
import type { InputProps } from './types';
import { useKeyShortcuts } from './useKeyShortcuts';

export type TrueFalseInputProps = InputProps<TrueFalseResponse, boolean> & {
  initial?: boolean | null;
};

const OPTIONS = [
  { value: true, label: 'True', key: '1', alt: 't' },
  { value: false, label: 'False', key: '2', alt: 'f' },
] as const;

/** Two big side-by-side cards. Emits `{ value: boolean }`. Web shortcuts: 1/T, 2/F. */
export function TrueFalseInput({ initial = null, onChange, disabled, reveal, shortcuts = true, testID }: TrueFalseInputProps) {
  const [picked, setPicked] = useState<boolean | null>(initial);
  const locked = !!disabled || !!reveal;

  const pick = (v: boolean) => {
    if (locked) return;
    setPicked(v);
    onChange({ value: v });
  };

  useKeyShortcuts({ '1': () => pick(true), t: () => pick(true), '2': () => pick(false), f: () => pick(false) }, shortcuts && !locked);

  const stateOf = (v: boolean): OptionState => {
    if (reveal) {
      if (v === reveal.correctAnswer) return 'correct';
      if (v === picked) return 'incorrect';
      return 'dimmed';
    }
    return v === picked ? 'selected' : 'idle';
  };

  return (
    <View style={styles.row} accessibilityRole="radiogroup" testID={testID}>
      {OPTIONS.map((o) => (
        <OptionCard
          key={o.label}
          testID={`tf-option-${o.value}`}
          label={o.label}
          badge={o.key}
          state={stateOf(o.value)}
          onPress={() => pick(o.value)}
          disabled={locked}
          accessibilityRole="radio"
          checked={picked === o.value}
          style={styles.cell}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  cell: { flex: 1, minHeight: 72 },
});
