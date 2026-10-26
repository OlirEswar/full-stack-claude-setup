import { Tabs } from 'expo-router';

import { colors } from '@/theme';

// Minimal shell so the post-login redirect resolves; task 25 adds the real tabs and tab bar.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Learn' }} />
    </Tabs>
  );
}
