import type { SessionSummary } from '@/api/types';

/**
 * Hand-off between the player and the summary screen. The completion payload is too rich for
 * URL params, so the player stashes it here keyed by session id. On a cold load (web refresh)
 * the summary screen falls back to POST /complete, which the server answers idempotently.
 */
const cache = new Map<number, SessionSummary>();

export const sessionSummaryCache = {
  set(sessionId: number, summary: SessionSummary) {
    cache.set(sessionId, summary);
  },
  get(sessionId: number): SessionSummary | undefined {
    return cache.get(sessionId);
  },
  clear() {
    cache.clear();
  },
};
