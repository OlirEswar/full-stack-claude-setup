import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, palette, radii, spacing } from '@/theme/tokens';

import { Button } from './Button';
import { AlertGlyph } from './icons';
import { StepResponseMark } from './StepResponseMark';
import { Text } from './Text';

type Action = { label: string; onPress: () => void };

export type EmptyStateProps = {
  title: string;
  message?: string;
  action?: Action;
  /** Replaces the default step-response illustration. */
  illustration?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Encouraging empty state built around the settled step-response mark. */
export function EmptyState({ title, message, action, illustration, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]} accessibilityRole="summary">
      <View style={[styles.badge, { backgroundColor: palette.primary.tint }]}>
        {illustration ?? <StepResponseMark width={150} />}
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="body" tone="muted" align="center" style={styles.message}>
          {message}
        </Text>
      ) : null}
      {action ? (
        <View style={styles.action}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

export type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Plain-spoken error with a retry. Defaults cover the common network failure. */
export function ErrorState({
  title = 'That loop didn’t close',
  message = 'We couldn’t reach the Loopy server. Check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
  style,
}: ErrorStateProps) {
  return (
    <View style={[styles.wrap, style]} accessibilityRole="alert">
      <View style={[styles.iconBubble, { backgroundColor: palette.error.tint, borderColor: palette.error.tint }]}>
        <AlertGlyph size={48} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="body" tone="muted" align="center" style={styles.message}>
        {message}
      </Text>
      {onRetry ? (
        <View style={styles.action}>
          <Button label={retryLabel} variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

export type LoadingStateProps = {
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/** On-theme loader: the step response draws itself and settles, on repeat. */
export function LoadingState({ label = 'Settling…', style }: LoadingStateProps) {
  return (
    <View
      style={[styles.wrap, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <StepResponseMark width={140} animated />
      <Text variant="label" tone="muted" align="center">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  badge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.xxl,
    marginBottom: spacing.sm,
  },
  iconBubble: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 2,
  },
  message: { maxWidth: 360, color: colors.textMuted },
  action: { marginTop: spacing.md, alignSelf: 'stretch', maxWidth: 360, width: '100%' },
});
