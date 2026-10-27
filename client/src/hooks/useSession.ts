import { useCallback, useEffect, useReducer, useRef } from 'react';

import { ApiError, completeSession, getSession, submitAnswer } from '@/api/client';
import type { AnswerResult, ClientQuestion, QuestionResponse, Session, SessionSummary } from '@/api/types';

import { haptic } from './haptics';

/**
 * Lesson player state machine.
 *
 *   loading ─▶ answering ─(Check)─▶ checking ─▶ feedback ─(Continue)─┬─▶ answering   (next question)
 *                  ▲                    │                            ├─▶ completing ─▶ complete
 *                  └──── check error ───┘                            └─▶ failed      (out of hearts)
 *
 * `error` covers a failed initial load or a failed completion; `retry` re-runs whichever it was.
 */
export type SessionPhase = 'loading' | 'error' | 'answering' | 'checking' | 'feedback' | 'completing' | 'complete' | 'failed';

export type SessionState = {
  phase: SessionPhase;
  session: Session | null;
  question: ClientQuestion | null;
  /** Current answer; null means "not answerable yet" (Check disabled). */
  response: QuestionResponse | null;
  /** Server verdict for the current question while in `feedback`. */
  result: AnswerResult | null;
  /** Questions finished (advanced past). Drives the progress bar. */
  answered: number;
  hearts: number;
  combo: number;
  summary: SessionSummary | null;
  /** Load/complete failure (phase `error`) or a transient Check failure (phase `answering`). */
  error: string | null;
};

type Action =
  | { type: 'loading' }
  | { type: 'loaded'; session: Session; question: ClientQuestion; answered: number }
  | { type: 'failed'; session?: Session; answered?: number }
  | { type: 'select'; response: QuestionResponse | null }
  | { type: 'checking' }
  | { type: 'checked'; result: AnswerResult }
  | { type: 'checkError'; message: string }
  | { type: 'advance'; question: ClientQuestion }
  | { type: 'completing'; session?: Session; answered?: number }
  | { type: 'completed'; summary: SessionSummary }
  | { type: 'error'; message: string };

const initialState: SessionState = {
  phase: 'loading',
  session: null,
  question: null,
  response: null,
  result: null,
  answered: 0,
  hearts: 0,
  combo: 0,
  summary: null,
  error: null,
};

function reducer(s: SessionState, a: Action): SessionState {
  switch (a.type) {
    case 'loading':
      return { ...s, phase: 'loading', error: null };
    case 'loaded':
      return {
        ...s,
        phase: 'answering',
        session: a.session,
        question: a.question,
        answered: a.answered,
        hearts: a.session.hearts,
        response: null,
        result: null,
        error: null,
      };
    case 'failed':
      return {
        ...s,
        phase: 'failed',
        session: a.session ?? s.session,
        answered: a.answered ?? s.answered,
        hearts: 0,
        error: null,
      };
    case 'select':
      return s.phase === 'answering' ? { ...s, response: a.response, error: null } : s;
    case 'checking':
      return { ...s, phase: 'checking', error: null };
    case 'checked':
      return { ...s, phase: 'feedback', result: a.result, hearts: a.result.hearts, combo: a.result.combo };
    case 'checkError':
      return { ...s, phase: 'answering', error: a.message };
    case 'advance':
      return { ...s, phase: 'answering', question: a.question, answered: s.answered + 1, response: null, result: null };
    case 'completing':
      return {
        ...s,
        phase: 'completing',
        session: a.session ?? s.session,
        answered: a.answered ?? (s.phase === 'feedback' ? s.answered + 1 : s.answered),
        error: null,
      };
    case 'completed':
      return { ...s, phase: 'complete', summary: a.summary };
    case 'error':
      return { ...s, phase: 'error', error: a.message };
  }
}

function messageOf(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.message) return e.message;
  return fallback;
}

export function useSession(sessionId: number) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const shownAt = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const complete = useCallback(async () => {
    try {
      const summary = await completeSession(sessionId);
      if (!alive.current) return;
      haptic('celebrate');
      dispatch({ type: 'completed', summary });
    } catch (e) {
      if (alive.current) dispatch({ type: 'error', message: messageOf(e, 'We couldn’t save your results. Try again.') });
    }
  }, [sessionId]);

  const load = useCallback(async () => {
    dispatch({ type: 'loading' });
    try {
      const res = await getSession(sessionId);
      if (!alive.current) return;
      const { session, question, answered } = res;
      if (session.status === 'failed') {
        dispatch({ type: 'failed', session, answered });
      } else if (session.status === 'completed' || !question) {
        dispatch({ type: 'completing', session, answered: session.total });
        await complete();
      } else {
        shownAt.current = Date.now();
        dispatch({ type: 'loaded', session, question, answered });
      }
    } catch (e) {
      if (alive.current) dispatch({ type: 'error', message: messageOf(e, 'We couldn’t load this lesson.') });
    }
  }, [sessionId, complete]);

  useEffect(() => {
    if (Number.isFinite(sessionId) && sessionId > 0) void load();
    else dispatch({ type: 'error', message: 'This lesson link looks broken.' });
  }, [sessionId, load]);

  const select = useCallback((response: QuestionResponse | null) => dispatch({ type: 'select', response }), []);

  const check = useCallback(async () => {
    const { phase, question, response } = state;
    if (phase !== 'answering' || !question || !response) return;
    dispatch({ type: 'checking' });
    try {
      const result = await submitAnswer(sessionId, {
        itemId: question.itemId,
        response,
        timeMs: Math.max(0, Date.now() - shownAt.current),
      });
      if (!alive.current) return;
      haptic(result.correct ? 'correct' : 'incorrect');
      dispatch({ type: 'checked', result });
    } catch (e) {
      if (alive.current) dispatch({ type: 'checkError', message: messageOf(e, 'Couldn’t check that answer. Try again.') });
    }
  }, [state, sessionId]);

  const next = useCallback(async () => {
    const { phase, result } = state;
    if (phase !== 'feedback' || !result) return;
    if (result.status === 'failed') {
      dispatch({ type: 'failed' });
    } else if (result.status === 'ready' || !result.next) {
      dispatch({ type: 'completing' });
      await complete();
    } else {
      shownAt.current = Date.now();
      dispatch({ type: 'advance', question: result.next });
    }
  }, [state, complete]);

  /** After a load failure, reload; after a completion failure, try saving again. */
  const retry = useCallback(() => {
    if (state.session) {
      dispatch({ type: 'completing' });
      void complete();
    } else {
      void load();
    }
  }, [state.session, complete, load]);

  return { ...state, select, check, next, retry };
}
