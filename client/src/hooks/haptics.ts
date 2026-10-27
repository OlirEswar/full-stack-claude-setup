import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticCue = 'correct' | 'incorrect' | 'celebrate';

/**
 * Fire-and-forget haptic feedback. Native only: on web `expo-haptics` has nothing to drive,
 * so it's skipped entirely. Failures are swallowed; haptics are garnish.
 */
export function haptic(cue: HapticCue): void {
  if (Platform.OS === 'web') return;
  try {
    const p =
      cue === 'correct'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : cue === 'incorrect'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Promise.resolve(p).catch(() => {});
  } catch {
    // Native module unavailable; ignore.
  }
}
