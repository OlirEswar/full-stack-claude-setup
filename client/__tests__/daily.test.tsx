import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import * as api from '@/api/client';
import type { DailyResponse, MeResponse, StartSessionResponse } from '@/api/types';

import DailyScreen from '../app/daily';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, getDaily: jest.fn(), getMe: jest.fn(), startDaily: jest.fn() };
});

const mockedApi = api as jest.Mocked<typeof api>;

const me = {
  user: { id: 1, username: 'bode_fan', timezone: 'UTC', dailyXpGoal: 20 },
  stats: {
    xpTotal: 120,
    xpToday: 15,
    dailyXpGoal: 20,
    dailyGoalMet: false,
    streak: 7,
    longestStreak: 9,
    streakFreezes: 1,
    hearts: 3,
    maxHearts: 5,
    nextHeartAt: null,
    dailyChallengeDone: false,
  },
} as MeResponse;

const daily = (over: Partial<DailyResponse> = {}): DailyResponse => ({
  date: '2026-10-27',
  status: 'not_started',
  sessionId: null,
  questionCount: 5,
  ...over,
});

const started = {
  session: { id: 42, kind: 'daily', skillId: null, total: 5, status: 'active', hearts: 3 },
  question: {
    itemId: 1,
    position: 0,
    total: 5,
    skillId: 'laplace-basics',
    difficulty: 1,
    kind: 'true_false',
    prompt: 'G(s) = 1/(s+1) has a pole at s = −1.',
  },
} as StartSessionResponse;

const routes = {
  daily: DailyScreen,
  'session/[id]': () => <Text testID="session-route">Session</Text>,
};

async function renderDaily(d: DailyResponse) {
  mockedApi.getDaily.mockResolvedValue(d);
  mockedApi.getMe.mockResolvedValue(me);
  await renderRouter(routes, { initialUrl: '/daily' });
  await screen.findByTestId('daily-meta');
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('daily challenge screen', () => {
  it('not_started shows Start and 5 questions · ~3 min', async () => {
    await renderDaily(daily());
    expect(screen.getByText('Start')).toBeTruthy();
    expect(screen.getByText('5 questions · ~3 min')).toBeTruthy();
  });

  it('in_progress shows Resume', async () => {
    await renderDaily(daily({ status: 'in_progress', sessionId: 9 }));
    expect(screen.getByText('Resume')).toBeTruthy();
    expect(screen.queryByText('Start')).toBeNull();
  });

  it('completed shows done state with streak count', async () => {
    await renderDaily(daily({ status: 'completed', sessionId: 9 }));
    expect(screen.getByText('Streak secured for today')).toBeTruthy();
    expect(screen.getByText('7-day streak')).toBeTruthy();
    expect(screen.queryByText('Start')).toBeNull();
    expect(screen.queryByText('Resume')).toBeNull();
  });

  it('Start calls startDaily and navigates to session', async () => {
    mockedApi.startDaily.mockResolvedValue(started);
    await renderDaily(daily());
    await fireEvent.press(screen.getByText('Start'));
    await waitFor(() => expect(mockedApi.startDaily).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('session-route')).toBeTruthy();
    expect(screen).toHavePathname('/session/42');
  });
});
