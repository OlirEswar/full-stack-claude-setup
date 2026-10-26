import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Switching between log in and sign up is a swap, not a drill-down.
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
