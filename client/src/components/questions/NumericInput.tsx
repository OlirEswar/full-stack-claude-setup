import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { NumericResponse } from '@/api/types';
import { Text } from '@/components/ui';
import { borders, colors, palette, radii, spacing, typeScale } from '@/theme/tokens';

import { ResultDot } from './OptionCard';
import type { InputProps } from './types';

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/**
 * Parse what a learner typed into a finite number, or null.
 * Accepts `-`, Unicode minus `−` (and en dash), `.` or `,` as the decimal mark, `e`/`E` exponents,
 * a leading `+`, and stray spaces. Rejects thousands separators, fractions and anything partial.
 */
export function parseNumeric(text: string): number | null {
  let t = text.replace(/[\s  ]/g, '').replace(/[−–‒]/g, '-');
  if (!t.includes('.') && (t.match(/,/g) ?? []).length === 1) t = t.replace(',', '.');
  if (!NUMBER_RE.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

export type NumericInputProps = InputProps<NumericResponse, number> & {
  unit?: string;
  initial?: string;
  placeholder?: string;
};

/** Number entry on a decimal keypad, with sign and exponent helper keys (the pad lacks them). Emits `{ value }` or null. */
export function NumericInput({ unit, initial = '', placeholder = '0.0', onChange, disabled, reveal, testID }: NumericInputProps) {
  const [text, setText] = useState(initial);
  const [focused, setFocused] = useState(false);
  const locked = !!disabled || !!reveal;
  const parsed = parseNumeric(text);
  const showInvalid = !focused && text.trim() !== '' && parsed === null && !locked;

  const update = (next: string) => {
    if (locked) return;
    setText(next);
    const v = parseNumeric(next);
    onChange(v === null ? null : { value: v });
  };

  const toggleSign = () => {
    const t = text.trimStart();
    if (t.startsWith('-') || t.startsWith('−')) update(t.slice(1));
    else update(`-${t.startsWith('+') ? t.slice(1) : t}`);
  };
  const addExponent = () => {
    if (/e/i.test(text)) return;
    update(`${text === '' ? '1' : text}e`);
  };

  const tone = reveal ? (reveal.correct ? palette.success : palette.error) : null;
  const borderColor = tone ? tone.base : showInvalid ? palette.warning.base : focused ? palette.primary.base : colors.border;
  const face = tone ? tone.tint : colors.surface;

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={[styles.field, { borderColor, backgroundColor: face }]}>
        <TextInput
          testID="numeric-field"
          value={text}
          onChangeText={update}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!locked}
          placeholder={placeholder}
          placeholderTextColor={colors.ink[300]}
          keyboardType="decimal-pad"
          inputMode="decimal"
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          returnKeyType="done"
          accessibilityLabel={unit ? `Answer in ${unit}` : 'Numeric answer'}
          accessibilityHint="Decimals or scientific notation, for example 0.707 or 2.5e-3"
          style={[styles.input, { color: tone ? tone.shade : colors.text }, Platform.OS === 'web' ? styles.webInput : null]}
        />
        {unit ? (
          <View style={styles.unit}>
            <Text style={[typeScale.monoStrong, styles.unitText]} testID="numeric-unit">
              {unit}
            </Text>
          </View>
        ) : null}
        {reveal ? <ResultDot ok={reveal.correct} /> : null}
      </View>

      <View style={styles.helpers}>
        {!locked ? (
          <>
            <HelperKey label="±" a11y="Toggle sign" onPress={toggleSign} testID="numeric-sign" />
            <HelperKey label="×10ⁿ" a11y="Add exponent" onPress={addExponent} testID="numeric-exp" />
          </>
        ) : null}
        <Text variant="caption" tone={showInvalid ? 'warning' : 'subtle'} style={styles.hint}>
          {showInvalid ? "That isn't a number yet. Try 0.707 or 2.5e-3." : locked ? '' : 'Decimals or e-notation are fine.'}
        </Text>
      </View>
    </View>
  );
}

function HelperKey({ label, a11y, onPress, testID }: { label: string; a11y: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.key,
        { borderBottomWidth: pressed ? borders.width : borders.edge, marginTop: pressed ? borders.edge - borders.width : 0 },
      ]}
    >
      <Text style={[typeScale.monoStrong, styles.keyText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    borderRadius: radii.lg,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
    paddingHorizontal: spacing.lg,
  },
  input: {
    ...typeScale.monoStrong,
    fontSize: 28,
    lineHeight: 36,
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.md,
  },
  webInput: { outlineStyle: 'none' } as object,
  unit: {
    backgroundColor: colors.ink[100],
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  unitText: { color: colors.textMuted, fontSize: 16 },
  helpers: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  key: {
    minWidth: 56,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: borders.width,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { color: colors.primary.base, fontSize: 16 },
  hint: { flex: 1, marginLeft: spacing.xs },
});
