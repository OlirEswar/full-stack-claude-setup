import { useState, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle } from 'react-native';

import { borders, colors, layout, radii, spacing, typeScale } from '@/theme/tokens';

import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'secureTextEntry'> & {
  label: string;
  /** Helper copy under the field, replaced by `error` when present. */
  hint?: string;
  error?: string | null;
  /** Password field with a Show/Hide toggle. */
  secure?: boolean;
  ref?: Ref<TextInputInstance>;
  style?: StyleProp<ViewStyle>;
};

/**
 * Labeled text input in the card vocabulary: 2px border plus a 4px bottom edge.
 * Focus turns the edge Loop Violet; an error turns it red.
 */
export function TextField({ label, hint, error, secure = false, ref, style, onFocus, onBlur, testID, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const tone = error ? colors.error : focused ? colors.primary : null;

  return (
    <View style={[styles.wrap, style]}>
      <Text variant="label" tone={error ? 'error' : focused ? 'primary' : 'muted'} nativeID={testID ? `${testID}-label` : undefined}>
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            borderColor: tone ? tone.base : colors.border,
            borderBottomColor: tone ? tone.shade : colors.borderStrong,
            backgroundColor: error ? colors.error.tint : colors.surface,
          },
        ]}
      >
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.ink[400]}
          selectionColor={colors.primary.base}
          cursorColor={colors.primary.base}
          secureTextEntry={secure && !revealed}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={spacing.sm}
            style={({ pressed }) => [styles.toggle, pressed && { backgroundColor: colors.primary.tint }]}
          >
            <Text variant="label" tone="primary">
              {revealed ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="error" accessibilityLiveRegion="polite" role="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + spacing.xxs },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.buttonHeight.lg,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
    borderRadius: radii.lg,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  input: {
    ...typeScale.body,
    flex: 1,
    alignSelf: 'stretch',
    color: colors.text,
    paddingVertical: spacing.md,
    // Drop the browser focus ring; the violet edge is the focus indicator.
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null),
  },
  toggle: {
    minHeight: layout.minTouch - spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
});
