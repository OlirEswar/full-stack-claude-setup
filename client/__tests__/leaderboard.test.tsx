import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import * as api from '@/api/client';
import type { LeaderboardEntry, LeaderboardResponse } from '@/api/types';
import { resetLabel } from '@/components/social';

import LeaderboardScreen from '../app/(tabs)/leaderboard';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, getLeaderboard: jest.fn() };
});

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, username: 'nyquist_ninja', timezone: 'UTC', dailyXpGoal: 20 }, logout: jest.fn() }),
}));

const mockedApi = api as jest.Mocked<typeof api>;

const names = ['zeta_queen', 'bode_fan', 'pole_position', 'routh_runner', 'nyquist_ninja', 'lqr_lad'];

function board(entries: LeaderboardEntry[], me: LeaderboardResponse['me']): LeaderboardResponse {
  return { weekStart: '2026-10-26', entries, me };
}

const routes = {
  index: LeaderboardScreen,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('leaderboard screen', () => {
  it('renders ranked entries and highlights me', async () => {
    const entries = names.map((username, i) => ({ rank: i + 1, username, xp: 600 - i * 80, isMe: username === 'nyquist_ninja' }));
    mockedApi.getLeaderboard.mockResolvedValue(board(entries, { rank: 5, xp: 280 }));
    await renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByTestId('leaderboard-list')).toBeTruthy();
    for (const name of names) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByText('600 XP')).toBeTruthy();

    // Ranks are in order.
    entries.forEach((e) => {
      expect(screen.getByTestId(`leaderboard-row-${e.rank}`).props.accessibilityLabel).toContain(`rank ${e.rank}`);
    });

    // Top 3 get medals; 4th onward doesn't.
    expect(screen.getByTestId('leaderboard-row-1-medal')).toBeTruthy();
    expect(screen.getByTestId('leaderboard-row-2-medal')).toBeTruthy();
    expect(screen.getByTestId('leaderboard-row-3-medal')).toBeTruthy();
    expect(screen.queryByTestId('leaderboard-row-4-medal')).toBeNull();
    expect(screen.getByTestId('leaderboard-row-1').props.accessibilityLabel).toMatch(/^Gold medal/);

    // My row is highlighted; nobody else's is.
    expect(screen.getByTestId('leaderboard-row-5').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('leaderboard-row-1').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByText('You')).toBeTruthy();

    // I'm already in the list, so no sticky rank footer.
    expect(screen.queryByTestId('my-rank-footer')).toBeNull();
    expect(mockedApi.getLeaderboard).toHaveBeenCalledTimes(1);
  });

  it('shows my rank footer when I am outside the top 50', async () => {
    const entries = Array.from({ length: 50 }, (_, i) => ({
      rank: i + 1,
      username: `learner_${String(i + 1).padStart(2, '0')}`,
      xp: 2000 - i * 30,
      isMe: false,
    }));
    mockedApi.getLeaderboard.mockResolvedValue(board(entries, { rank: 73, xp: 40 }));
    await renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByTestId('leaderboard-list')).toBeTruthy();
    expect(screen.getByTestId('leaderboard-row-50')).toBeTruthy();
    const footer = screen.getByTestId('my-rank-footer');
    expect(footer).toBeTruthy();
    const mine = screen.getByTestId('my-rank-row');
    expect(mine.props.accessibilityLabel).toBe('rank 73, you, 40 XP');
    expect(mine.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('73')).toBeTruthy();
    expect(screen.getByText('nyquist_ninja')).toBeTruthy();
  });

  it('empty leaderboard shows empty state', async () => {
    mockedApi.getLeaderboard.mockResolvedValue(board([], { rank: 4, xp: 0 }));
    await renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByTestId('leaderboard-empty')).toBeTruthy();
    expect(screen.getByText('The board is wide open')).toBeTruthy();
    expect(screen.queryByTestId('leaderboard-list')).toBeNull();
    expect(screen.queryByTestId('my-rank-footer')).toBeNull();
  });

  it('shows loading, then an error with retry', async () => {
    let fail: (e: unknown) => void = () => {};
    mockedApi.getLeaderboard.mockReturnValueOnce(new Promise((_, reject) => (fail = reject)));
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByTestId('leaderboard-loading')).toBeTruthy();

    fail(new api.ApiError(0, 'Couldn’t reach the Loopy server. Check your connection and try again.'));
    expect(await screen.findByTestId('leaderboard-error')).toBeTruthy();

    mockedApi.getLeaderboard.mockResolvedValue(board([{ rank: 1, username: 'zeta_queen', xp: 90, isMe: false }], { rank: 2, xp: 0 }));
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByTestId('leaderboard-list')).toBeTruthy();
  });

  it('formats the weekly reset countdown', () => {
    const monday = '2026-10-26';
    expect(resetLabel(monday, Date.parse('2026-10-27T10:00:00Z'))).toBe('Resets in 5d 14h');
    expect(resetLabel(monday, Date.parse('2026-11-01T22:30:00Z'))).toBe('Resets in 1h 30m');
    expect(resetLabel(monday, Date.parse('2026-11-02T00:00:00Z'))).toBe('Resetting now');
    expect(resetLabel('nope')).toBeNull();
  });
});
