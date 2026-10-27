import { act, fireEvent, renderHook, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import * as api from '@/api/client';
import type { AnswerResult, ClientQuestion, GetSessionResponse, Session, SessionSummary } from '@/api/types';
import { sessionSummaryCache } from '@/hooks/sessionSummaryCache';
import { useSession } from '@/hooks/useSession';

import SessionScreen from '../app/session/[id]';
import SummaryScreen from '../app/session/summary';

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return {
    ...actual,
    getSession: jest.fn(),
    submitAnswer: jest.fn(),
    completeSession: jest.fn(),
    startSession: jest.fn(),
  };
});

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Heavy: 'heavy' },
}));

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'bode_fan', timezone: 'UTC', dailyXpGoal: 20 } }),
}));

const mockedApi = api as jest.Mocked<typeof api>;

const session: Session = { id: 42, kind: 'lesson', skillId: 'second-order', total: 2, status: 'active', hearts: 3 };

const q1: ClientQuestion = {
  itemId: 101,
  position: 0,
  total: 2,
  skillId: 'second-order',
  difficulty: 2,
  kind: 'mcq',
  prompt: 'Which damping ratio gives about 5% overshoot?',
  choices: ['ζ = 0.2', 'ζ = 0.7', 'ζ = 1.0'],
};

const q2: ClientQuestion = {
  itemId: 102,
  position: 1,
  total: 2,
  skillId: 'second-order',
  difficulty: 2,
  kind: 'true_false',
  prompt: 'A critically damped system overshoots its setpoint.',
};

function answer(over: Partial<AnswerResult> = {}): AnswerResult {
  return {
    correct: true,
    correctAnswer: 1,
    correctAnswerText: 'ζ = 0.7',
    explanation: 'Overshoot = exp(−πζ/√(1−ζ²)); at ζ = 0.7 that is about 4.6%.',
    combo: 1,
    hearts: 3,
    comboBonusXp: 0,
    status: 'active',
    next: q2,
    ...over,
  };
}

const summary: SessionSummary = {
  xpEarned: 15,
  xpBreakdown: [
    { label: 'Lesson complete', amount: 10 },
    { label: 'Perfect lesson', amount: 5 },
  ],
  correct: 2,
  total: 2,
  accuracy: 1,
  maxCombo: 2,
  perfect: true,
  streak: 4,
  streakExtended: true,
  dailyGoalMet: false,
  xpToday: 15,
  levelUp: null,
  newAchievements: [{ id: 'first-steps', title: 'First Steps' }],
};

const routes = {
  index: () => <Text>Home</Text>,
  'session/[id]': SessionScreen,
  'session/summary': SummaryScreen,
};

async function renderSession(res: Partial<GetSessionResponse> = {}) {
  mockedApi.getSession.mockResolvedValue({ session, question: q1, answered: 0, ...res });
  const app = await renderRouter(routes, { initialUrl: '/session/42' });
  await screen.findByText(q1.prompt);
  return app;
}

const progressNow = () => screen.getByTestId('session-progress').props.accessibilityValue.now;

beforeEach(() => {
  jest.clearAllMocks();
  sessionSummaryCache.clear();
});

describe('session player', () => {
  it('Check is disabled until an answer is given', async () => {
    await renderSession();
    expect(screen.getByTestId('check-button').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByText('ζ = 0.7'));
    expect(screen.getByTestId('check-button').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('shows FeedbackSheet with explanation after Check', async () => {
    mockedApi.submitAnswer.mockResolvedValue(answer());
    await renderSession();
    await fireEvent.press(screen.getByText('ζ = 0.7'));
    await fireEvent.press(screen.getByTestId('check-button'));

    expect(await screen.findByTestId('feedback-sheet')).toBeTruthy();
    expect(screen.getByTestId('feedback-explanation')).toHaveTextContent(/ζ = 0.7 that is about 4.6%/);
    expect(mockedApi.submitAnswer).toHaveBeenCalledWith(42, expect.objectContaining({ itemId: 101, response: { choice: 1 } }));
    // Correct answers don't print the answer again.
    expect(screen.queryByTestId('feedback-correct-answer')).toBeNull();
    expect(screen.queryByTestId('check-button')).toBeNull();
  });

  it('double-tapping Check submits the answer only once', async () => {
    // Both taps land before a re-render, so each sees the same stale 'answering' state.
    mockedApi.getSession.mockResolvedValue({ session, question: q1, answered: 0 });
    mockedApi.submitAnswer.mockResolvedValue(answer());
    const { result } = await renderHook(() => useSession(42));
    await waitFor(() => expect(result.current.phase).toBe('answering'));
    await act(async () => result.current.select({ choice: 1 }));
    const { check } = result.current;
    await act(async () => {
      await Promise.all([check(), check()]);
    });

    expect(mockedApi.submitAnswer).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('feedback');
  });

  it('incorrect answer shows correct answer text', async () => {
    mockedApi.submitAnswer.mockResolvedValue(answer({ correct: false, combo: 0, hearts: 2 }));
    await renderSession();
    await fireEvent.press(screen.getByText('ζ = 0.2'));
    await fireEvent.press(screen.getByTestId('check-button'));

    expect(await screen.findByText('Not quite')).toBeTruthy();
    expect(screen.getByTestId('feedback-correct-answer')).toHaveTextContent('ζ = 0.7');
    expect(screen.getByLabelText('2 hearts left')).toBeTruthy();
    expect(screen.getByLabelText('You lost a heart')).toBeTruthy();
  });

  it('Continue advances to next question and updates progress', async () => {
    mockedApi.submitAnswer.mockResolvedValue(answer({ combo: 3, comboBonusXp: 0 }));
    await renderSession();
    expect(progressNow()).toBe(0);
    await fireEvent.press(screen.getByText('ζ = 0.7'));
    await fireEvent.press(screen.getByTestId('check-button'));
    expect(await screen.findByTestId('combo-badge')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('continue-button'));

    expect(await screen.findByText(q2.prompt)).toBeTruthy();
    expect(screen.queryByText(q1.prompt)).toBeNull();
    expect(screen.queryByTestId('feedback-sheet')).toBeNull();
    expect(progressNow()).toBe(1);
    expect(screen.getByTestId('check-button').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('last answer triggers complete and navigates to summary', async () => {
    mockedApi.submitAnswer
      .mockResolvedValueOnce(answer())
      .mockResolvedValueOnce(answer({ correctAnswer: false, correctAnswerText: 'False', combo: 2, status: 'ready', next: null }));
    mockedApi.completeSession.mockResolvedValue(summary);
    const app = await renderSession();

    await fireEvent.press(screen.getByText('ζ = 0.7'));
    await fireEvent.press(screen.getByTestId('check-button'));
    await fireEvent.press(await screen.findByTestId('continue-button'));
    await fireEvent.press(await screen.findByText('False'));
    await fireEvent.press(screen.getByTestId('check-button'));
    await fireEvent.press(await screen.findByTestId('continue-button'));

    expect(await screen.findByTestId('summary-screen')).toBeTruthy();
    expect(mockedApi.completeSession).toHaveBeenCalledTimes(1);
    expect(mockedApi.completeSession).toHaveBeenCalledWith(42);
    expect(app.getPathname()).toBe('/session/summary');
    expect(app.getSearchParams()).toMatchObject({ sessionId: '42' });
  });

  it('failed status shows out-of-hearts screen', async () => {
    mockedApi.submitAnswer.mockResolvedValue(answer({ correct: false, combo: 0, hearts: 0, status: 'failed', next: null }));
    const app = await renderSession({ session: { ...session, hearts: 1 } });
    await fireEvent.press(screen.getByText('ζ = 0.2'));
    await fireEvent.press(screen.getByTestId('check-button'));
    await fireEvent.press(await screen.findByTestId('continue-button'));

    expect(await screen.findByTestId('out-of-hearts')).toBeTruthy();
    expect(screen.getByText('You’re out of hearts')).toBeTruthy();
    expect(mockedApi.completeSession).not.toHaveBeenCalled();

    // Resuming an already-failed session goes straight there too.
    await app.unmount();
    mockedApi.getSession.mockResolvedValue({ session: { ...session, status: 'failed', hearts: 0 }, question: null, answered: 1 });
    await renderRouter(routes, { initialUrl: '/session/42' });
    await waitFor(() => expect(screen.getByTestId('out-of-hearts')).toBeTruthy());
  });
});

describe('session summary', () => {
  it('summary shows XP earned, accuracy and streak-extended banner', async () => {
    mockedApi.completeSession.mockResolvedValue(summary);
    await renderRouter(routes, { initialUrl: '/session/summary?sessionId=42' });

    expect(await screen.findByTestId('summary-screen')).toBeTruthy();
    expect(mockedApi.completeSession).toHaveBeenCalledWith(42);
    expect(screen.getByLabelText('15 XP earned')).toBeTruthy();
    expect(screen.getByTestId('summary-accuracy')).toHaveTextContent(/100%/);
    expect(screen.getByTestId('streak-extended-banner')).toHaveTextContent(/Streak extended!/);
    expect(screen.getByText(/4 days in a row/)).toBeTruthy();
    expect(screen.getByText('First Steps')).toBeTruthy();
  });
});
