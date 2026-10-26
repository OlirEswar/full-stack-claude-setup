import { act, render, screen, waitFor } from '@testing-library/react-native';
import { createElement } from 'react';
import { Text } from 'react-native';

import * as api from '@/api/client';
import { ApiError, setAuthToken, setUnauthorizedHandler } from '@/api/client';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { tokenStorage } from '@/auth/tokenStorage';

jest.mock('@/auth/tokenStorage', () => {
  let stored: string | null = null;
  return {
    tokenStorage: {
      getToken: jest.fn(async () => stored),
      setToken: jest.fn(async (t: string) => {
        stored = t;
      }),
      clearToken: jest.fn(async () => {
        stored = null;
      }),
    },
  };
});

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit?]>;

function jsonResponse(status: number, body?: unknown): Response {
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  } as unknown as Response;
}

function mockFetch(...responses: Response[]): FetchMock {
  const fn: FetchMock = jest.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  fn.mockResolvedValue(jsonResponse(500, { error: 'unexpected call' }));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function headersOf(call: [string, RequestInit?]): Record<string, string> {
  return (call[1]?.headers ?? {}) as Record<string, string>;
}

const user = { id: 1, username: 'ada_l', timezone: 'Europe/Berlin', dailyXpGoal: 20 };
const meBody = {
  user,
  stats: {
    xpTotal: 0,
    xpToday: 0,
    dailyXpGoal: 20,
    dailyGoalMet: false,
    streak: 0,
    longestStreak: 0,
    streakFreezes: 0,
    hearts: 5,
    maxHearts: 5,
    nextHeartAt: null,
    dailyChallengeDone: false,
  },
};

beforeEach(() => {
  setAuthToken(null);
  setUnauthorizedHandler(null);
  jest.clearAllMocks();
});

describe('api client', () => {
  it('adds Authorization header when token present', async () => {
    const fetchMock = mockFetch(jsonResponse(200, { units: [] }), jsonResponse(200, { units: [] }));

    await api.getPath();
    expect(headersOf(fetchMock.mock.calls[0]).Authorization).toBeUndefined();

    setAuthToken('tok-123');
    await api.getPath();
    expect(headersOf(fetchMock.mock.calls[1]).Authorization).toBe('Bearer tok-123');
  });

  it('uses EXPO_PUBLIC_API_URL base', async () => {
    const original = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.loopy.test/';
    try {
      const fetchMock = mockFetch(jsonResponse(200, { ok: true }));
      let isolated!: typeof import('@/api/client');
      jest.isolateModules(() => {
        isolated = jest.requireActual<typeof import('@/api/client')>('@/api/client');
      });
      await isolated.health();
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.loopy.test/health');
    } finally {
      if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = original;
    }
  });

  it('defaults to http://localhost:3000', async () => {
    const fetchMock = mockFetch(jsonResponse(200, meBody));
    await api.getMe();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/api/me');
  });

  it('throws ApiError with status on 401', async () => {
    mockFetch(jsonResponse(401, { error: 'Unauthorized' }));
    setAuthToken('stale');
    const err = await api.getMe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).message).toBe('Unauthorized');
  });

  it('uses the server {error} message for other failures', async () => {
    mockFetch(jsonResponse(409, { error: 'Username already taken' }));
    await expect(api.register({ username: 'ada_l', password: 'password1' })).rejects.toMatchObject({
      status: 409,
      message: 'Username already taken',
    });
  });

  it('maps network failures to ApiError status 0', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
    await expect(api.getPath()).rejects.toMatchObject({ status: 0 });
  });

  it('calls the unauthorized handler on 401 from an authenticated call only', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);

    mockFetch(jsonResponse(401, { error: 'Invalid username or password' }));
    await expect(api.login({ username: 'ada_l', password: 'wrongpass' })).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();

    setAuthToken('stale');
    mockFetch(jsonResponse(401, { error: 'Unauthorized' }));
    await expect(api.getPath()).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('register sends timezone', async () => {
    const fetchMock = mockFetch(jsonResponse(201, { token: 't', user }));
    await api.register({ username: 'ada_l', password: 'password1', timezone: 'Europe/Berlin' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/auth/register');
    expect(init?.method).toBe('POST');
    expect(headersOf(fetchMock.mock.calls[0])['Content-Type']).toBe('application/json');
    expect(JSON.parse(init?.body as string)).toEqual({
      username: 'ada_l',
      password: 'password1',
      timezone: 'Europe/Berlin',
    });
  });

  it('submitAnswer posts {itemId, response, timeMs}', async () => {
    const result = {
      correct: true,
      correctAnswer: 2,
      correctAnswerText: 's = -2',
      explanation: 'The pole is the root of the denominator.',
      combo: 3,
      hearts: 5,
      comboBonusXp: 0,
      status: 'active',
      next: null,
    };
    const fetchMock = mockFetch(jsonResponse(200, result));
    setAuthToken('tok');
    const res = await api.submitAnswer(42, { itemId: 7, response: { choice: 2 }, timeMs: 5300 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/sessions/42/answer');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ itemId: 7, response: { choice: 2 }, timeMs: 5300 });
    expect(res).toEqual(result);
  });
});

describe('AuthContext', () => {
  let auth: ReturnType<typeof useAuth>;
  function Probe() {
    auth = useAuth();
    return createElement(Text, null, auth.loading ? 'loading' : (auth.user?.username ?? 'signed-out'));
  }

  it('register sends the device timezone and stores the token', async () => {
    const fetchMock = mockFetch(jsonResponse(201, { token: 'new-tok', user }));
    await render(createElement(AuthProvider, null, createElement(Probe)));
    await waitFor(() => expect(screen.getByText('signed-out')).toBeTruthy());

    await act(async () => {
      await auth.register('ada_l', 'password1');
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(tokenStorage.setToken).toHaveBeenCalledWith('new-tok');
    expect(api.getAuthToken()).toBe('new-tok');
    expect(screen.getByText('ada_l')).toBeTruthy();
  });

  it('clears the token and drops to logged-out on a 401', async () => {
    await tokenStorage.setToken('stored-tok');
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    mockFetch(jsonResponse(200, { ...meBody, user: { ...user, timezone: tz } }), jsonResponse(401, { error: 'Unauthorized' }));
    await render(createElement(AuthProvider, null, createElement(Probe)));
    await waitFor(() => expect(screen.getByText('ada_l')).toBeTruthy());
    expect(auth.isAuthenticated).toBe(true);

    await act(async () => {
      await api.getPath().catch(() => {});
    });
    expect(screen.getByText('signed-out')).toBeTruthy();
    expect(auth.isAuthenticated).toBe(false);
    expect(tokenStorage.clearToken).toHaveBeenCalled();
    expect(api.getAuthToken()).toBeNull();
  });
});
