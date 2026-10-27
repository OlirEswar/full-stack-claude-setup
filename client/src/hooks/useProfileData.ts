import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { ApiError, getMe, getStats } from '@/api/client';
import type { MeResponse, StatsResponse } from '@/api/types';

export type ProfileData = { stats: StatsResponse; me: MeResponse };

export type ProfileState = {
  data: ProfileData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Swap in a fresh /api/me payload (e.g. the PATCH response) without refetching stats. */
  setMe: (me: MeResponse) => void;
};

/** Stats + profile for the Profile tab. Refetches on focus so totals are fresh after a lesson. */
export function useProfileData(): ProfileState {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const [stats, me] = await Promise.all([getStats(), getMe()]);
      if (id !== requestId.current) return;
      if (!stats?.last7Days || !me?.user) throw new ApiError(0, 'The server sent an unexpected response. Try again.');
      setData({ stats, me });
    } catch (e) {
      if (id !== requestId.current) return;
      setError(
        e instanceof ApiError && e.message ? e.message : 'Couldn’t reach the Loopy server. Check your connection and try again.',
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

  const setMe = useCallback((me: MeResponse) => setData((d) => (d ? { ...d, me } : d)), []);

  return { data, loading, error, reload: () => void load(), setMe };
}
