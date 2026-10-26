import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/theme/tokens';

export type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Sticky region pinned under the content column (e.g. a lesson CTA). */
  footer?: ReactNode;
  /** Sticky region above content (e.g. stat pills / lesson progress). */
  header?: ReactNode;
  edges?: Edge[];
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Page shell: safe-area aware, with a centered content column capped at 640px so
 * desktop web reads like a phone-width lesson rather than a stretched form.
 */
export function Screen({
  children,
  scroll = true,
  footer,
  header,
  edges = ['top', 'bottom', 'left', 'right'],
  background = colors.background,
  contentStyle,
  testID,
}: ScreenProps) {
  const column = [styles.column, contentStyle];
  return (
    <SafeAreaView testID={testID} edges={edges} style={[styles.root, { backgroundColor: background }]}>
      {header ? <View style={[styles.column, styles.header]}>{header}</View> : null}
      {scroll ? (
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={column}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.flex, column]}>{children}</View>
      )}
      {footer ? <View style={[styles.column, styles.footer]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  column: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  header: { paddingVertical: spacing.md },
  footer: { paddingVertical: spacing.lg },
});
