import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import * as api from '@/api/client';
import type { DailyResponse, MeResponse, MistakesResponse, PathResponse, PathSkill, StartSessionResponse } from '@/api/types';
import { nextHeartLabel } from '@/components/path';

import TabsLayout from '../app/(tabs)/_layout';
import AchievementsScreen from '../app/(tabs)/achievements';
import HomeScreen from '../app/(tabs)/index';
import LeaderboardScreen from '../app/(tabs)/leaderboard';
import ProfileScreen from '../app/(tabs)/profile';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return {
    ...actual,
    getMe: jest.fn(),
    getPath: jest.fn(),
    getDaily: jest.fn(),
    getMistakes: jest.fn(),
    startSession: jest.fn(),
  };
});

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'bode_fan', timezone: 'UTC', dailyXpGoal: 20 }, logout: jest.fn() }),
}));

const mockedApi = api as jest.Mocked<typeof api>;

function skill(over: Partial<PathSkill> & Pick<PathSkill, 'id' | 'title'>): PathSkill {
  return {
    level: 0,
    maxLevel: 5,
    lessonsInLevel: 0,
    lessonsPerLevel: 3,
    unlocked: false,
    started: false,
    due: false,
    strength: 0,
    ...over,
  };
}

const path: PathResponse = {
  units: [
    {
      id: 'u1',
      title: 'Signals & Laplace',
      description: 'Transforms, poles and the s-plane.',
      skills: [
        skill({ id: 'laplace-basics', title: 'Laplace Basics', level: 2, lessonsInLevel: 1, unlocked: true, started: true, due: true, strength: 0.4 }),
        skill({ id: 'transfer-functions', title: 'Transfer Functions', unlocked: true }),
      ],
    },
    {
      id: 'u2',
      title: 'Time Response',
      description: 'First and second order systems.',
      skills: [skill({ id: 'second-order', title: 'Second-Order Systems' })],
    },
  ],
};

function me(over: Partial<MeResponse['stats']> = {}): MeResponse {
  return {
    user: { id: 1, username: 'bode_fan', timezone: 'UTC', dailyXpGoal: 20 },
    stats: {
      xpTotal: 120,
      xpToday: 15,
      dailyXpGoal: 20,
      dailyGoalMet: false,
      streak: 4,
      longestStreak: 9,
      streakFreezes: 1,
      hearts: 3,
      maxHearts: 5,
      nextHeartAt: new Date(Date.now() + 12 * 60_000).toISOString(),
      dailyChallengeDone: false,
      ...over,
    },
  };
}

const daily: DailyResponse = { date: '2026-10-27', status: 'not_started', sessionId: null, questionCount: 5 };
const mistakes = (count: number): MistakesResponse => ({
  count,
  items: Array.from({ length: count }, (_, i) => ({
    questionRef: `q${i}`,
    skillId: 'laplace-basics',
    skillTitle: 'Laplace Basics',
    lastWrongAt: '2026-10-26T10:00:00Z',
  })),
});

const started: StartSessionResponse = {
  session: { id: 77, kind: 'lesson', skillId: 'transfer-functions', total: 8, status: 'active', hearts: 3 },
  question: {
    itemId: 1,
    position: 0,
    total: 8,
    skillId: 'transfer-functions',
    difficulty: 1,
    kind: 'true_false',
    prompt: 'G(s) = 1/(s+1) has a pole at s = −1.',
  },
};

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeScreen,
  '(tabs)/leaderboard': LeaderboardScreen,
  '(tabs)/achievements': AchievementsScreen,
  '(tabs)/profile': ProfileScreen,
  'session/[id]': () => <Text testID="session-route">Session</Text>,
  daily: () => <Text>Daily</Text>,
};

function mockHome({ stats = {}, mistakeCount = 2 }: { stats?: Partial<MeResponse['stats']>; mistakeCount?: number } = {}) {
  mockedApi.getMe.mockResolvedValue(me(stats));
  mockedApi.getPath.mockResolvedValue(path);
  mockedApi.getDaily.mockResolvedValue(daily);
  mockedApi.getMistakes.mockResolvedValue(mistakes(mistakeCount));
}

async function renderHome() {
  const app = await renderRouter(routes, { initialUrl: '/' });
  await screen.findByTestId('skill-path');
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('home / path screen', () => {
  it('renders unit titles and skill titles from /api/path', async () => {
    mockHome();
    await renderHome();
    expect(screen.getByText('Signals & Laplace')).toBeTruthy();
    expect(screen.getByText('Time Response')).toBeTruthy();
    expect(screen.getByText('Laplace Basics')).toBeTruthy();
    expect(screen.getByText('Transfer Functions')).toBeTruthy();
    expect(screen.getByText('Second-Order Systems')).toBeTruthy();
    // Top bar and cards come from /api/me, /api/daily and /api/mistakes.
    expect(screen.getByTestId('stat-streak').props.accessibilityLabel).toBe('4 day streak');
    expect(screen.getByTestId('stat-hearts').props.accessibilityLabel).toBe('3 hearts left');
    expect(screen.getByTestId('next-heart')).toHaveTextContent('+1 in 12m');
    expect(screen.getByTestId('xp-ring').props.accessibilityValue).toMatchObject({ now: 15, max: 20 });
    expect(screen.getByTestId('daily-card')).toBeTruthy();
    expect(screen.getByTestId('mistakes-count')).toHaveTextContent('2');
    expect(screen.getByTestId('crown-laplace-basics')).toHaveTextContent('2');
  });

  it('locked skill node is disabled', async () => {
    mockHome();
    await renderHome();
    const locked = screen.getByTestId('skill-node-second-order');
    expect(locked.props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('skill-node-transfer-functions').props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(locked);
    expect(mockedApi.startSession).not.toHaveBeenCalled();
  });

  it('due skill shows due badge', async () => {
    mockHome();
    await renderHome();
    expect(screen.getByTestId('due-badge-laplace-basics')).toBeTruthy();
    expect(screen.queryByTestId('due-badge-transfer-functions')).toBeNull();
    expect(screen.queryByTestId('due-badge-second-order')).toBeNull();
  });

  it('tapping unlocked skill starts lesson and navigates to session', async () => {
    mockHome();
    mockedApi.startSession.mockResolvedValue(started);
    const app = await renderHome();
    await fireEvent.press(screen.getByTestId('skill-node-transfer-functions'));
    await waitFor(() => expect(mockedApi.startSession).toHaveBeenCalledWith({ kind: 'lesson', skillId: 'transfer-functions' }));
    expect(await screen.findByTestId('session-route')).toBeTruthy();
    expect(app.getPathname()).toBe('/session/77');
  });

  it("no hearts shows a 'hearts empty' message instead of starting a lesson", async () => {
    mockHome({ stats: { hearts: 0 } });
    const app = await renderHome();
    expect(screen.queryByTestId('hearts-empty')).toBeNull();
    await fireEvent.press(screen.getByTestId('skill-node-transfer-functions'));
    expect(await screen.findByTestId('hearts-empty')).toBeTruthy();
    expect(screen.getByText('Your hearts are empty')).toBeTruthy();
    expect(mockedApi.startSession).not.toHaveBeenCalled();
    expect(app.getPathname()).toBe('/');
  });

  it('mistakes card hidden when count is 0', async () => {
    mockHome({ mistakeCount: 0 });
    await renderHome();
    expect(screen.queryByTestId('mistakes-card')).toBeNull();
  });

  it('mistakes card starts a mistakes session', async () => {
    mockHome({ mistakeCount: 3 });
    mockedApi.startSession.mockResolvedValue({ ...started, session: { ...started.session, id: 88, kind: 'mistakes', skillId: null } });
    const app = await renderHome();
    await fireEvent.press(screen.getByTestId('mistakes-card'));
    await waitFor(() => expect(mockedApi.startSession).toHaveBeenCalledWith({ kind: 'mistakes' }));
    await screen.findByTestId('session-route');
    expect(app.getPathname()).toBe('/session/88');
  });

  it('daily challenge card links to /daily', async () => {
    mockHome();
    const app = await renderHome();
    await fireEvent.press(screen.getByTestId('daily-card'));
    expect(await screen.findByText('Daily')).toBeTruthy();
    expect(app.getPathname()).toBe('/daily');
  });

  it('loading and error states render', async () => {
    let fail: (e: unknown) => void = () => {};
    mockedApi.getMe.mockReturnValueOnce(new Promise((_, reject) => (fail = reject)));
    mockedApi.getPath.mockResolvedValue(path);
    mockedApi.getDaily.mockResolvedValue(daily);
    mockedApi.getMistakes.mockResolvedValue(mistakes(0));
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByTestId('home-loading')).toBeTruthy();
    expect(screen.queryByTestId('skill-path')).toBeNull();

    fail(new api.ApiError(0, 'Couldn’t reach the Loopy server. Check your connection and try again.'));
    expect(await screen.findByTestId('home-error')).toBeTruthy();
    expect(screen.getByText('Your path didn’t load')).toBeTruthy();

    // Retry recovers.
    mockedApi.getMe.mockResolvedValue(me());
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByTestId('skill-path')).toBeTruthy();
  });

  it('next-heart label formats the countdown', () => {
    const now = Date.parse('2026-10-27T10:00:00Z');
    expect(nextHeartLabel(null, now)).toBeNull();
    expect(nextHeartLabel('2026-10-27T10:23:10Z', now)).toBe('+1 in 24m');
    expect(nextHeartLabel('2026-10-27T11:30:00Z', now)).toBe('+1 in 1h 30m');
    expect(nextHeartLabel('2026-10-27T09:59:00Z', now)).toBe('+1 any moment');
  });
});
