import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/api/client';

export type FocusedResource<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const alwaysValid = () => true;

/**
 * Loads one endpoint for a tab and refetches whenever the tab regains focus
 * (same behaviour as the Learn tab's `useHomeData`). Stale responses from an
 * earlier request are dropped; the last good data is kept on refresh errors.
 * Pass stable (module-level) `fetcher`/`isValid` functions, or the tab refetches every render.
 */
export function useFocusedResource<T>(
  fetcher: () => Promise<T>,
  isValid: (value: T) => boolean = alwaysValid,
): FocusedResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const value = await fetcher();
      if (id !== requestId.current) return;
      if (!value || !isValid(value)) {
        throw new ApiError(0, 'The server sent an unexpected response. Try again.');
      }
      setData(value);
    } catch (e) {
      if (id !== requestId.current) return;
      setError(
        e instanceof ApiError && e.message
          ? e.message
          : 'Couldn’t reach the Loopy server. Check your connection and try again.',
      );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [fetcher, isValid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { data, loading, error, reload: () => void load() };
}
