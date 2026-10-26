// Per-weight subpath imports so the bundle only ships the 6 faces we use (the package root pulls in all ~36).
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';

import { tokens } from './tokens';

export * from './tokens';

/** Font map passed to `useFonts` in the root layout. Keys match `fontFamilies`. */
export const fontAssets = {
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
};

export const theme = tokens;

/** Light mode only for v1. A hook, so a dark theme can slot in later without call-site changes. */
export function useTheme() {
  return theme;
}
