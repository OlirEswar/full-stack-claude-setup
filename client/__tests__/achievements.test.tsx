import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import * as api from '@/api/client';
import type { Achievement } from '@/api/types';

import AchievementsScreen from '../app/(tabs)/achievements';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, getAchievements: jest.fn() };
});

const mockedApi = api as jest.Mocked<typeof api>;

function badge(over: Partial<Achievement> & Pick<Achievement, 'id' | 'title'>): Achievement {
  return {
    description: 'Do the thing.',
    icon: 'star',
    unlocked: false,
    unlockedAt: null,
    progress: { current: 0, target: 1 },
    ...over,
  };
}

const achievements: Achievement[] = [
  badge({
    id: 'first-steps',
    title: 'First Steps',
    description: 'Complete your first lesson.',
    icon: 'footsteps',
    unlocked: true,
    unlockedAt: '2026-10-20T09:15:00Z',
    progress: { current: 1, target: 1 },
  }),
  badge({
    id: 'streak-3',
    title: 'Warming Up',
    description: 'Reach a 3-day streak.',
    icon: 'flame',
    unlocked: true,
    unlockedAt: '2026-10-23T18:00:00Z',
    progress: { current: 3, target: 3 },
  }),
  badge({
    id: 'sharpshooter',
    title: 'Sharpshooter',
    description: 'Answer 100 questions correctly.',
    icon: 'target',
    progress: { current: 37, target: 100 },
  }),
  badge({ id: 'bode-boss', title: 'Bode Boss', description: 'Reach level 3 in Bode plots.', icon: 'chart', progress: { current: 1, target: 3 } }),
  badge({ id: 'mystery', title: 'Mystery Badge', icon: 'unknown-icon', progress: { current: 0, target: 5 } }),
];

const routes = { index: AchievementsScreen };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('achievements screen', () => {
  it('achievements grid shows unlocked and locked badges', async () => {
    mockedApi.getAchievements.mockResolvedValue({ achievements });
    await renderRouter(routes, { initialUrl: '/' });

    const unlockedGrid = await screen.findByTestId('achievements-unlocked');
    const lockedGrid = screen.getByTestId('achievements-locked');

    // Unlocked badges sit in the "Earned" grid with an earned date and no lock.
    for (const id of ['first-steps', 'streak-3']) {
      expect(within(unlockedGrid).getByTestId(`badge-${id}`)).toBeTruthy();
      expect(screen.queryByTestId(`badge-lock-${id}`)).toBeNull();
      expect(screen.queryByTestId(`badge-progress-${id}`)).toBeNull();
    }
    expect(screen.getByTestId('badge-earned-first-steps')).toHaveTextContent('Earned Oct 20, 2026');
    expect(screen.getByTestId('badge-first-steps').props.accessibilityLabel).toMatch(/^First Steps, unlocked/);

    // Locked ones sit in "Still to unlock" with a lock overlay.
    for (const id of ['sharpshooter', 'bode-boss', 'mystery']) {
      expect(within(lockedGrid).getByTestId(`badge-${id}`)).toBeTruthy();
      expect(screen.getByTestId(`badge-lock-${id}`)).toBeTruthy();
      expect(screen.getByTestId(`badge-${id}`).props.accessibilityState).toMatchObject({ disabled: true });
    }
    expect(within(unlockedGrid).queryByTestId('badge-sharpshooter')).toBeNull();

    expect(screen.getByText('Warming Up')).toBeTruthy();
    expect(screen.getByText('Mystery Badge')).toBeTruthy();
    expect(screen.getByText('of 5 earned')).toBeTruthy();
    // The closest locked badge is surfaced (Sharpshooter 37% vs Bode Boss 33%).
    expect(screen.getByTestId('achievements-next')).toHaveTextContent(/Closest next: Sharpshooter/);
  });

  it('locked badge shows progress current/target', async () => {
    mockedApi.getAchievements.mockResolvedValue({ achievements });
    await renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByTestId('badge-progress-sharpshooter')).toHaveTextContent('37 / 100');
    expect(screen.getByTestId('badge-bar-sharpshooter').props.accessibilityValue).toMatchObject({ now: 37, max: 100 });
    expect(screen.getByTestId('badge-progress-bode-boss')).toHaveTextContent('1 / 3');
    expect(screen.getByTestId('badge-progress-mystery')).toHaveTextContent('0 / 5');
    expect(screen.getByTestId('badge-sharpshooter').props.accessibilityLabel).toBe(
      'Sharpshooter, locked, 37 of 100. Answer 100 questions correctly.',
    );
  });

  it('shows loading, then an error with retry', async () => {
    let fail: (e: unknown) => void = () => {};
    mockedApi.getAchievements.mockReturnValueOnce(new Promise((_, reject) => (fail = reject)));
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByTestId('achievements-loading')).toBeTruthy();

    fail(new api.ApiError(500, 'Request failed (500)'));
    expect(await screen.findByTestId('achievements-error')).toBeTruthy();
    expect(screen.getByText('Your badges didn’t load')).toBeTruthy();

    mockedApi.getAchievements.mockResolvedValue({ achievements });
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByTestId('achievements-unlocked')).toBeTruthy();
  });

  it('nothing unlocked yet shows an inline nudge', async () => {
    mockedApi.getAchievements.mockResolvedValue({ achievements: achievements.filter((a) => !a.unlocked) });
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByTestId('achievements-none-unlocked')).toBeTruthy();
    expect(screen.queryByTestId('achievements-unlocked')).toBeNull();
  });
});
