import { Tabs } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { MedalGlyph, ProfileGlyph, TraceGlyph, TrophyGlyph, lockedTone } from '@/components/ui';
import { borders, colors, palette, radii, typeScale } from '@/theme/tokens';

/** Tab icon in a pill that fills with the tone's tint when the tab is active. */
function TabIcon({ focused, children, tint, edge }: { focused: boolean; children: ReactNode; tint: string; edge: string }) {
  return (
    <View style={[styles.icon, focused && { backgroundColor: tint, borderColor: edge }]}>
      {children}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary.shade,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Learn',
          tabBarButtonTestID: 'tab-learn',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} tint={palette.primary.tint} edge={palette.primary.base}>
              <TraceGlyph size={24} color={focused ? palette.primary.base : colors.ink[400]} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarButtonTestID: 'tab-leaderboard',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} tint={palette.xp.tint} edge={palette.xp.base}>
              <TrophyGlyph size={24} tone={focused ? palette.xp : lockedTone} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="achievements"
        options={{
          title: 'Badges',
          tabBarButtonTestID: 'tab-achievements',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} tint={palette.accent.tint} edge={palette.accent.base}>
              <MedalGlyph size={24} tone={focused ? palette.accent : lockedTone} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarButtonTestID: 'tab-profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} tint={palette.secondary.tint} edge={palette.secondary.base}>
              <ProfileGlyph size={24} tone={focused ? palette.secondary : lockedTone} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: borders.width,
    borderTopColor: colors.border,
    height: 76,
    paddingTop: 8,
    paddingBottom: 10,
  },
  item: { paddingVertical: 2 },
  label: { ...typeScale.label, fontSize: 11, lineHeight: 14, letterSpacing: 0.5, marginTop: 4 },
  icon: {
    width: 48,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borders.width,
    borderColor: 'transparent',
  },
});
