/**
 * Typed fetch wrapper for the Loopy API. One function per endpoint in the
 * spec's API table. The bearer token lives in memory here (AuthContext loads
 * it from tokenStorage and calls `setAuthToken`), so requests never wait on
 * secure storage.
 */
import { API_URL } from '@/config';

import type {
  AchievementsResponse,
  AnswerResult,
  AuthResponse,
  DailyResponse,
  GetSessionResponse,
  HealthResponse,
  LeaderboardResponse,
  LoginBody,
  MeResponse,
  MistakesResponse,
  PathResponse,
  RegisterBody,
  SessionSummary,
  StartSessionBody,
  StartSessionResponse,
  StatsResponse,
  SubmitAnswerBody,
  UpdateMeBody,
} from './types';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Thrown-error status for failures that never reached the server (offline, DNS, CORS). */
export const NETWORK_ERROR_STATUS = 0;

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/** Called whenever an authenticated request comes back 401 (expired/revoked token). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Auth endpoints: a 401 there means bad credentials, not an expired session. */
  skipUnauthorizedHandler?: boolean;
};

function baseUrl(): string {
  return API_URL.replace(/\/+$/, '');
}

async function request<T>(path: string, { method = 'GET', body, skipUnauthorizedHandler }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const sentToken = authToken;
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_STATUS, 'Couldn’t reach the Loopy server. Check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    // Only treat it as a lost session if the request actually carried the current token.
    if (res.status === 401 && !skipUnauthorizedHandler && sentToken && sentToken === authToken) {
      onUnauthorized?.();
    }
    throw new ApiError(res.status, message);
  }

  return data as T;
}

/** The device's IANA time zone, e.g. `Europe/Berlin`; undefined if unavailable. */
export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

// Endpoints -------------------------------------------------------------------

export const health = () => request<HealthResponse>('/health');

export const register = (body: RegisterBody) =>
  request<AuthResponse>('/api/auth/register', { method: 'POST', body, skipUnauthorizedHandler: true });

export const login = (body: LoginBody) =>
  request<AuthResponse>('/api/auth/login', { method: 'POST', body, skipUnauthorizedHandler: true });

export const logout = () => request<void>('/api/auth/logout', { method: 'POST', skipUnauthorizedHandler: true });

export const getMe = () => request<MeResponse>('/api/me');

export const updateMe = (body: UpdateMeBody) => request<MeResponse>('/api/me', { method: 'PATCH', body });

export const getPath = () => request<PathResponse>('/api/path');

export const startSession = (body: StartSessionBody) =>
  request<StartSessionResponse>('/api/sessions', { method: 'POST', body });

export const getSession = (sessionId: number) => request<GetSessionResponse>(`/api/sessions/${sessionId}`);

export const submitAnswer = (sessionId: number, body: SubmitAnswerBody) =>
  request<AnswerResult>(`/api/sessions/${sessionId}/answer`, {
    method: 'POST',
    body: { itemId: body.itemId, response: body.response, timeMs: body.timeMs },
  });

export const completeSession = (sessionId: number) =>
  request<SessionSummary>(`/api/sessions/${sessionId}/complete`, { method: 'POST' });

export const getDaily = () => request<DailyResponse>('/api/daily');

export const startDaily = () => request<StartSessionResponse>('/api/daily/start', { method: 'POST' });

export const getMistakes = () => request<MistakesResponse>('/api/mistakes');

export const getAchievements = () => request<AchievementsResponse>('/api/achievements');

export const getStats = () => request<StatsResponse>('/api/stats');

export const getLeaderboard = () => request<LeaderboardResponse>('/api/leaderboard');
