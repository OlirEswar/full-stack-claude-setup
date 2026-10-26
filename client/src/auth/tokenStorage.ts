/**
 * Persists the bearer token: expo-secure-store on iOS/Android, localStorage on
 * web (SecureStore has no web backend). All failures are swallowed — a broken
 * keychain should log the user out, not crash the app.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'loopy.authToken';

function webStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const tokenStorage = {
  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return webStorage()?.getItem(KEY) ?? null;
      return await SecureStore.getItemAsync(KEY);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') webStorage()?.setItem(KEY, token);
      else await SecureStore.setItemAsync(KEY, token);
    } catch {
      // Token stays in memory for this run; the user will just sign in again next launch.
    }
  },

  async clearToken(): Promise<void> {
    try {
      if (Platform.OS === 'web') webStorage()?.removeItem(KEY);
      else await SecureStore.deleteItemAsync(KEY);
    } catch {
      // Nothing more we can do.
    }
  },
};
