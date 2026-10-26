import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlertGlyph, BoltGlyph, Card, FlameGlyph, HeartGlyph, StepResponseMark, Text } from '@/components/ui';
import { borders, colors, palette, radii, spacing } from '@/theme';

/** Above this width the brand story gets its own panel beside the form. */
const WIDE_BREAKPOINT = 900;
const FORM_MAX_WIDTH = 440;

export const APP_PITCH = '5 minutes a day keeps control theory sharp.';

const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <BoltGlyph size={24} />,
    title: 'Bite-size loops',
    body: 'Poles, Bode plots, root locus and PID, a few questions at a time.',
  },
  {
    icon: <FlameGlyph size={24} />,
    title: 'Streaks that stick',
    body: 'A daily challenge and a streak to protect keep the habit going.',
  },
  {
    icon: <HeartGlyph size={24} />,
    title: 'Learns from your misses',
    body: 'Questions adapt to you, and mistakes come back until they settle.',
  },
];

export type AuthShellProps = {
  /** Eyebrow + title above the form, e.g. "Welcome back". */
  eyebrow: string;
  title: string;
  children: ReactNode;
  /** Switch link under the form card ("New here? Create an account"). */
  footer?: ReactNode;
  testID?: string;
};

/**
 * Layout for the sign-in screens: compact brand hero above the form on phones,
 * a split brand panel + form on wide (desktop web) screens.
 */
export function AuthShell({ eyebrow, title, children, footer, testID }: AuthShellProps) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  const form = (
    <View style={styles.formColumn}>
      {!wide ? <CompactHero /> : null}
      <Card padding="xl" style={styles.formCard}>
        <Text variant="label" tone="primary">
          {eyebrow}
        </Text>
        <Text variant="title" style={styles.formTitle}>
          {title}
        </Text>
        <View style={styles.formBody}>{children}</View>
      </Card>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );

  return (
    <SafeAreaView testID={testID} style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.flex, wide && styles.row]}>
          {wide ? <BrandPanel /> : null}
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, wide && styles.scrollContentWide]}
            keyboardShouldPersistTaps="handled"
          >
            {form}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CompactHero() {
  return (
    <View style={styles.hero}>
      <View style={styles.heroBadge}>
        <StepResponseMark width={150} />
      </View>
      <Text variant="display" align="center">
        Loopy
      </Text>
      <Text variant="body" tone="muted" align="center">
        {APP_PITCH}
      </Text>
    </View>
  );
}

function BrandPanel() {
  return (
    <View style={styles.panel} accessibilityRole="summary">
      <View style={styles.panelInner}>
        <View style={styles.scope}>
          <StepResponseMark width={260} />
        </View>
        <Text variant="display" tone="onColor" style={styles.panelTitle}>
          Loopy
        </Text>
        <Text variant="heading" tone="onColor" style={styles.panelPitch}>
          {APP_PITCH}
        </Text>
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <View style={styles.featureIcon}>{f.icon}</View>
              <View style={styles.flex}>
                <Text variant="bodyStrong" tone="onColor">
                  {f.title}
                </Text>
                <Text variant="caption" style={styles.featureBody}>
                  {f.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <Text variant="caption" style={styles.panelFoot}>
          You overshoot a bit, then you settle. That’s learning.
        </Text>
      </View>
    </View>
  );
}

/** Form-level error (bad credentials, server unreachable). Announced to screen readers. */
export function FormBanner({ message }: { message: string }) {
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <AlertGlyph size={20} />
      <Text variant="body" style={styles.bannerText}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  scrollContentWide: { paddingHorizontal: spacing.xxxl },
  formColumn: { width: '100%', maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' },
  formCard: { backgroundColor: colors.surface },
  formTitle: { marginTop: spacing.xs },
  formBody: { marginTop: spacing.xl, gap: spacing.lg },
  footer: { marginTop: spacing.lg, alignItems: 'center' },

  hero: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xl },
  heroBadge: {
    backgroundColor: palette.primary.tint,
    borderRadius: radii.xxl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },

  panel: {
    flex: 1,
    maxWidth: 620,
    backgroundColor: colors.primary.base,
    borderRightWidth: borders.edge,
    borderRightColor: colors.primary.shade,
    justifyContent: 'center',
    padding: spacing.xxxl,
  },
  panelInner: { maxWidth: 440, width: '100%', alignSelf: 'center' },
  scope: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    borderBottomWidth: borders.edge,
    borderBottomColor: colors.primary.shade,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },
  panelTitle: { fontSize: 48, lineHeight: 56 },
  panelPitch: { marginTop: spacing.xs, marginBottom: spacing.xxl },
  features: { gap: spacing.lg },
  feature: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderBottomWidth: borders.edge,
    borderBottomColor: colors.primary.shade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBody: { color: colors.primary.tint, marginTop: spacing.xxs },
  panelFoot: { color: colors.primary.tint, marginTop: spacing.xxl, fontStyle: 'italic' },

  banner: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.error.tint,
    borderColor: colors.error.base,
    borderWidth: borders.width,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  bannerText: { flex: 1, color: colors.error.shade },
});
