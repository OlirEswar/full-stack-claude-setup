import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { ApiError, getDaily, getMe, getMistakes, getPath } from '@/api/client';
import type { DailyResponse, MeStats, MistakesResponse, PathResponse } from '@/api/types';

export type HomeData = {
  stats: MeStats;
  path: PathResponse;
  daily: DailyResponse | null;
  mistakes: MistakesResponse | null;
};

export type HomeState = {
  data: HomeData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * Everything the Learn tab shows. Refetches whenever the tab regains focus, so
 * hearts/XP/crowns are fresh after returning from a session. Stats and the path
 * are required; daily/mistakes failing only hides their cards.
 */
export function useHomeData(): HomeState {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const [me, path, daily, mistakes] = await Promise.all([
        getMe(),
        getPath(),
        getDaily().catch(() => null),
        getMistakes().catch(() => null),
      ]);
      if (id !== requestId.current) return;
      if (!me?.stats || !path?.units) throw new ApiError(0, 'The server sent an unexpected response. Try again.');
      setData({ stats: me.stats, path, daily, mistakes });
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { data, loading, error, reload: () => void load() };
}
