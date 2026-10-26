import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { LoadingState } from '@/components/ui';
import { colors, fontAssets } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (e.g. fast refresh); nothing to do.
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Keep the splash up until fonts are in; on failure fall back to system fonts rather than hang.
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * Route guard. Keys off the token (`isAuthenticated`), not `user`, so a signed-in
 * user who launches offline still lands in the app instead of being bounced to login.
 * Signed out: only `(auth)` exists and everything else redirects to /login.
 * Signed in: only `(tabs)` exists and the auth screens redirect to the home tab.
 */
export function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();

  // Restoring the stored session; don't flash the login screen at a returning user.
  if (loading) return <LoadingState label="Settling…" style={{ backgroundColor: colors.background }} />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={isAuthenticated} redirectTo="/login">
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
