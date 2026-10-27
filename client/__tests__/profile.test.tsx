import { render } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import * as api from '@/api/client';
import type { MeResponse, StatsResponse } from '@/api/types';
import { AuthProvider } from '@/auth/AuthContext';
import { tokenStorage } from '@/auth/tokenStorage';
import { WeekXpBars } from '@/components/profile';

import { RootNavigator } from '../app/_layout';
import AuthLayout from '../app/(auth)/_layout';
import LoginScreen from '../app/(auth)/login';
import RegisterScreen from '../app/(auth)/register';
import TabsLayout from '../app/(tabs)/_layout';
import ProfileScreen from '../app/(tabs)/profile';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return {
    ...actual,
    getMe: jest.fn(),
    getStats: jest.fn(),
    updateMe: jest.fn(),
    logout: jest.fn(),
  };
});

let mockStoredToken: string | null = null;
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: {
    getToken: jest.fn(async () => mockStoredToken),
    setToken: jest.fn(async (t: string) => {
      mockStoredToken = t;
    }),
    clearToken: jest.fn(async () => {
      mockStoredToken = null;
    }),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function me(dailyXpGoal = 20): MeResponse {
  return {
    user: { id: 1, username: 'bode_fan', timezone: 'UTC', dailyXpGoal },
    stats: {
      xpTotal: 1240,
      xpToday: 15,
      dailyXpGoal,
      dailyGoalMet: false,
      streak: 4,
      longestStreak: 12,
      streakFreezes: 1,
      hearts: 5,
      maxHearts: 5,
      nextHeartAt: null,
      dailyChallengeDone: false,
    },
  };
}

const last7Days = [
  { date: '2026-10-21', xp: 0 },
  { date: '2026-10-22', xp: 25 },
  { date: '2026-10-23', xp: 10 },
  { date: '2026-10-24', xp: 0 },
  { date: '2026-10-25', xp: 40 },
  { date: '2026-10-26', xp: 20 },
  { date: '2026-10-27', xp: 15 },
];

const stats: StatsResponse = {
  xpTotal: 1240,
  answered: 160,
  accuracy: 0.8125,
  lessonsCompleted: 18,
  longestStreak: 12,
  last7Days,
  skills: [
    { skillId: 'laplace-basics', title: 'Laplace basics', level: 3, ability: 0.42, accuracy: 0.9, strength: 0.85, started: true },
    { skillId: 'transfer-functions', title: 'Transfer functions', level: 1, ability: -0.3, accuracy: 0.6, strength: 0.3, started: true },
    { skillId: 'poles-zeros', title: 'Poles & zeros', level: 0, ability: 0, accuracy: 0, strength: 0, started: false },
  ],
};

function AuthWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const routes = {
  _layout: RootNavigator,
  '(auth)/_layout': AuthLayout,
  '(auth)/login': LoginScreen,
  '(auth)/register': RegisterScreen,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/profile': ProfileScreen,
};

async function renderProfile() {
  const app = await renderRouter(routes, { initialUrl: '/profile', wrapper: AuthWrapper });
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStoredToken = 'tok-123';
  api.setAuthToken(null);
  mockedApi.getMe.mockResolvedValue(me());
  mockedApi.getStats.mockResolvedValue(stats);
  mockedApi.logout.mockResolvedValue(undefined);
});

describe('profile screen', () => {
  it('renders total XP, accuracy %, longest streak', async () => {
    await renderProfile();
    expect(await screen.findByTestId('profile-stat-grid')).toBeTruthy();
    expect(screen.getByTestId('stat-total-xp-value')).toHaveTextContent('1,240');
    expect(screen.getByTestId('stat-accuracy-value')).toHaveTextContent('81%');
    expect(screen.getByTestId('stat-longest-streak-value')).toHaveTextContent('12');
    expect(screen.getByTestId('stat-lessons-value')).toHaveTextContent('18');
    // Per-skill stats: only started skills get a row.
    expect(screen.getByTestId('skill-accuracy-laplace-basics')).toHaveTextContent('90%');
    expect(screen.getByTestId('skill-level-transfer-functions').props.accessibilityLabel).toBe('Level 1 of 5');
    expect(screen.queryByTestId('skill-stats-poles-zeros')).toBeNull();
    expect(screen.getByText('Needs review')).toBeTruthy();
    expect(screen.getByTestId('week-xp-total')).toHaveTextContent('110 XP');
  });

  it('WeekXpBars renders 7 bars', async () => {
    await render(<WeekXpBars days={last7Days} goal={20} />);
    expect(screen.getAllByTestId('week-xp-bar')).toHaveLength(7);
    expect(screen.getByTestId('week-xp-bars').props.accessibilityLabel).toContain('Sun 40');
  });

  it('changing daily goal calls updateMe with dailyXpGoal', async () => {
    mockedApi.updateMe.mockResolvedValue(me(30));
    await renderProfile();
    const option = await screen.findByTestId('goal-option-30');
    expect(screen.getByTestId('goal-option-20').props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(option);
    await waitFor(() => expect(mockedApi.updateMe).toHaveBeenCalledWith({ dailyXpGoal: 30 }));
    await waitFor(() => expect(screen.getByTestId('goal-option-30').props.accessibilityState).toMatchObject({ selected: true }));
    expect(screen.getByTestId('goal-option-20').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('shows an error and keeps the old goal when saving fails', async () => {
    mockedApi.updateMe.mockRejectedValue(new api.ApiError(0, 'offline'));
    await renderProfile();
    await fireEvent.press(await screen.findByTestId('goal-option-50'));
    expect(await screen.findByTestId('goal-error')).toHaveTextContent(/Couldn’t save that goal/);
    expect(screen.getByTestId('goal-option-20').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('logout clears token and routes to login', async () => {
    const app = await renderProfile();
    await fireEvent.press(await screen.findByTestId('logout-button'));
    expect(await screen.findByTestId('login-screen')).toBeTruthy();
    expect(mockedApi.logout).toHaveBeenCalledTimes(1);
    expect(tokenStorage.clearToken).toHaveBeenCalled();
    expect(mockStoredToken).toBeNull();
    expect(api.getAuthToken()).toBeNull();
    expect(app.getPathname()).toBe('/login');
  });

  it('shows loading, then an error with retry and a logout escape hatch', async () => {
    let fail: (e: unknown) => void = () => {};
    mockedApi.getStats.mockReturnValueOnce(new Promise((_, reject) => (fail = reject)));
    await renderProfile();
    expect(await screen.findByTestId('profile-loading')).toBeTruthy();
    expect(screen.getByTestId('logout-button')).toBeTruthy();

    fail(new api.ApiError(0, 'Couldn’t reach the Loopy server. Check your connection and try again.'));
    expect(await screen.findByTestId('profile-error')).toBeTruthy();
    expect(screen.getByText('Your stats didn’t load')).toBeTruthy();

    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByTestId('profile-stat-grid')).toBeTruthy();
  });

  it('shows an encouraging empty state before any skill is started', async () => {
    mockedApi.getStats.mockResolvedValue({
      ...stats,
      answered: 0,
      accuracy: 0,
      skills: stats.skills.map((s) => ({ ...s, started: false })),
    });
    await renderProfile();
    expect(await screen.findByTestId('skill-stats-empty')).toBeTruthy();
    expect(screen.getByTestId('stat-accuracy-value')).toHaveTextContent('–');
  });
});
