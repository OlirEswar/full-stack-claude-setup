import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MatchResponse } from '@/api/types';
import { Text } from '@/components/ui';
import { colors, palette, radii, spacing, typeScale, type Tone } from '@/theme/tokens';

import { OptionCard, type OptionState } from './OptionCard';
import type { InputProps } from './types';

/**
 * Pair colors, by left index. Violet is reserved for "currently selected" and green/red for
 * feedback, so pairs use the other brand tones; the numbered chip disambiguates any repeats.
 */
export const PAIR_TONES: Tone[] = ['secondary', 'accent', 'streak', 'xp', 'heart'];

export type MatchInputProps = InputProps<MatchResponse, number[]> & {
  left: string[];
  right: string[];
  initial?: (number | null)[];
};

const longest = (xs: string[]) => xs.reduce((m, s) => Math.max(m, s.length), 0);

/**
 * Tap a left item, then its partner on the right. Matched pairs share a color and a numbered chip.
 * Emits `{ pairs }` (pairs[i] = displayed right index for left i) only once every left item is paired.
 */
export function MatchInput({ left, right, initial, onChange, disabled, reveal, testID }: MatchInputProps) {
  const [pairs, setPairs] = useState<(number | null)[]>(() => left.map((_, i) => initial?.[i] ?? null));
  const [active, setActive] = useState<number | null>(null);
  const locked = !!disabled || !!reveal;

  const commit = (next: (number | null)[]) => {
    setPairs(next);
    onChange(next.every((p): p is number => p !== null) ? { pairs: next } : null);
  };

  const tapLeft = (i: number) => {
    if (locked) return;
    // Always select (no toggle-off): after a pair, selection auto-advances, and tapping that
    // already-active item must confirm it rather than silently deselect it.
    setActive(i);
  };

  const tapRight = (j: number) => {
    if (locked) return;
    const owner = pairs.indexOf(j);
    if (active === null) {
      // Tapping a matched right item with nothing selected undoes that pair and re-selects its left.
      if (owner >= 0) {
        commit(pairs.map((p) => (p === j ? null : p)));
        setActive(owner);
      }
      return;
    }
    const next = pairs.map((p) => (p === j ? null : p));
    next[active] = j;
    commit(next);
    // Advance to the next unpaired left item so a run of taps flows top to bottom.
    let nextActive: number | null = null;
    for (let k = 1; k <= left.length; k++) {
      const idx = (active + k) % left.length;
      if (next[idx] === null) {
        nextActive = idx;
        break;
      }
    }
    setActive(nextActive);
  };

  const ownerOf = (j: number) => pairs.indexOf(j);
  const pairOk = (i: number) => !!reveal && pairs[i] === reveal.correctAnswer[i];

  const leftState = (i: number): OptionState => {
    if (reveal) return pairs[i] === null ? 'dimmed' : pairOk(i) ? 'correct' : 'incorrect';
    if (active === i) return 'selected';
    return pairs[i] !== null ? 'selected' : 'idle';
  };
  const rightState = (j: number): OptionState => {
    const owner = ownerOf(j);
    if (reveal) return owner < 0 ? 'dimmed' : pairOk(owner) ? 'correct' : 'incorrect';
    return owner >= 0 ? 'selected' : 'idle';
  };
  const leftTone = (i: number): Tone => (active === i ? 'primary' : PAIR_TONES[i % PAIR_TONES.length]);

  // Wider right column when its labels are much longer (e.g. "ζ = 1" vs "Critically damped").
  const lw = longest(left);
  const rw = longest(right);
  const rightFlex = rw > lw * 2 ? 1.6 : lw > rw * 2 ? 0.7 : 1;
  const pairedCount = pairs.filter((p) => p !== null).length;

  return (
    <View style={styles.wrap} testID={testID}>
      <Text variant="caption" tone="subtle" testID="match-hint">
        {locked
          ? `${pairedCount} of ${left.length} matched`
          : active === null
            ? 'Tap an item on the left, then its match on the right.'
            : `Now pick the match for “${left[active]}”.`}
      </Text>
      <View style={styles.columns}>
        <View style={[styles.col, { flex: 1 }]}>
          {left.map((l, i) => {
            const paired = pairs[i] !== null;
            return (
              <OptionCard
                key={`l-${i}`}
                testID={`match-left-${i}`}
                compact
                label={l}
                state={leftState(i)}
                tone={leftTone(i)}
                onPress={() => tapLeft(i)}
                disabled={locked}
                checked={active === i}
                accessibilityHint={paired ? `Matched with ${right[pairs[i] as number]}` : 'Select, then choose its match'}
                trailing={paired && !reveal ? <PairChip n={i + 1} tone={PAIR_TONES[i % PAIR_TONES.length]} /> : null}
                style={styles.item}
              />
            );
          })}
        </View>
        <View style={[styles.col, { flex: rightFlex }]}>
          {right.map((r, j) => {
            const owner = ownerOf(j);
            return (
              <OptionCard
                key={`r-${j}`}
                testID={`match-right-${j}`}
                compact
                label={r}
                state={rightState(j)}
                tone={owner >= 0 ? PAIR_TONES[owner % PAIR_TONES.length] : undefined}
                onPress={() => tapRight(j)}
                disabled={locked}
                checked={owner >= 0}
                accessibilityHint={owner >= 0 ? `Matched with ${left[owner]}` : undefined}
                trailing={owner >= 0 && !reveal ? <PairChip n={owner + 1} tone={PAIR_TONES[owner % PAIR_TONES.length]} /> : null}
                style={styles.item}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

function PairChip({ n, tone }: { n: number; tone: Tone }) {
  const p = palette[tone];
  return (
    <View style={[styles.chip, { backgroundColor: p.base, borderColor: p.shade }]} testID={`pair-chip-${n}`}>
      <Text style={[typeScale.monoStrong, styles.chipText, { color: p.on }]}>{n}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  columns: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  col: { gap: spacing.sm, minWidth: 0 },
  item: { minHeight: 56 },
  chip: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderBottomWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 12, lineHeight: 14, color: colors.textOnColor },
});
