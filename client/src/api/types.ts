/**
 * Response/request shapes for the Loopy API. Mirrors `.claude/state/spec.md`
 * ("API surface", "Client-safe question") and `server/src/content/types.ts`.
 * Server errors are always `{ error: string }`.
 */

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type QuestionKind = 'mcq' | 'true_false' | 'numeric' | 'multi_select' | 'match';

export type FigureSpec =
  | { type: 'pole_zero'; poles: { re: number; im: number }[]; zeros: { re: number; im: number }[] }
  | {
      type: 'step_response';
      points: [number, number][];
      finalValue?: number;
      xLabel?: string;
      yLabel?: string;
    }
  | {
      type: 'bode_mag';
      /** [ω rad/s, dB], ω log-spaced */
      points: [number, number][];
      asymptotes?: [number, number][];
    };

/** What the client receives for a question; never contains the answer. */
export interface ClientQuestion {
  itemId: number;
  position: number;
  total: number;
  skillId: string;
  difficulty: Difficulty;
  kind: QuestionKind;
  prompt: string;
  figure?: FigureSpec;
  /** mcq, multi_select (server-shuffled) */
  choices?: string[];
  /** match (right side server-shuffled) */
  left?: string[];
  right?: string[];
  /** numeric */
  unit?: string;
}

/** Responses; indices refer to the displayed (shuffled) order. */
export type McqResponse = { choice: number };
export type TrueFalseResponse = { value: boolean };
export type NumericResponse = { value: number };
export type MultiSelectResponse = { choices: number[] };
/** pairs[i] = index into displayed `right` matched with left i */
export type MatchResponse = { pairs: number[] };
export type QuestionResponse =
  | McqResponse
  | TrueFalseResponse
  | NumericResponse
  | MultiSelectResponse
  | MatchResponse;

/** Every error body the server sends. */
export interface ErrorBody {
  error: string;
}

// Auth / me -------------------------------------------------------------------

export interface User {
  id: number;
  username: string;
  timezone: string;
  dailyXpGoal: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterBody {
  username: string;
  password: string;
  timezone?: string;
}

export interface LoginBody {
  username: string;
  password: string;
}

export interface MeStats {
  xpTotal: number;
  xpToday: number;
  dailyXpGoal: number;
  dailyGoalMet: boolean;
  streak: number;
  longestStreak: number;
  streakFreezes: number;
  hearts: number;
  maxHearts: number;
  /** ISO timestamp; null when hearts are full. */
  nextHeartAt: string | null;
  dailyChallengeDone: boolean;
}

export interface MeResponse {
  user: User;
  stats: MeStats;
}

export interface UpdateMeBody {
  timezone?: string;
  dailyXpGoal?: number;
}

// Path ------------------------------------------------------------------------

export interface PathSkill {
  id: string;
  title: string;
  level: number;
  maxLevel: number;
  lessonsInLevel: number;
  lessonsPerLevel: number;
  unlocked: boolean;
  started: boolean;
  due: boolean;
  /** 0..1 memory strength */
  strength: number;
}

export interface PathUnit {
  id: string;
  title: string;
  description: string;
  skills: PathSkill[];
}

export interface PathResponse {
  units: PathUnit[];
}

// Sessions --------------------------------------------------------------------

export type SessionKind = 'lesson' | 'practice' | 'mistakes' | 'daily';
export type SessionStatus = 'active' | 'failed' | 'ready' | 'completed';

export interface Session {
  id: number;
  kind: SessionKind;
  skillId: string | null;
  total: number;
  status: SessionStatus;
  hearts: number;
}

export type StartSessionBody = { kind: 'lesson'; skillId: string } | { kind: 'practice' } | { kind: 'mistakes' };

export interface StartSessionResponse {
  session: Session;
  question: ClientQuestion;
}

export interface GetSessionResponse {
  session: Session;
  question: ClientQuestion | null;
  answered: number;
}

export interface SubmitAnswerBody {
  itemId: number;
  response: QuestionResponse;
  timeMs: number;
}

export interface AnswerResult {
  correct: boolean;
  /** Answer key in display order (choice index, boolean, number, index list or pairs). */
  correctAnswer: number | boolean | number[];
  correctAnswerText: string;
  explanation: string;
  combo: number;
  hearts: number;
  comboBonusXp: number;
  status: 'active' | 'failed' | 'ready';
  next: ClientQuestion | null;
}

export interface XpBreakdownLine {
  label: string;
  amount: number;
}

export interface SessionSummary {
  xpEarned: number;
  xpBreakdown: XpBreakdownLine[];
  correct: number;
  total: number;
  accuracy: number;
  maxCombo: number;
  perfect: boolean;
  streak: number;
  streakExtended: boolean;
  dailyGoalMet: boolean;
  xpToday: number;
  levelUp: { skillId: string; level: number } | null;
  newAchievements: { id: string; title: string }[];
}

// Daily -----------------------------------------------------------------------

export interface DailyResponse {
  date: string;
  status: 'not_started' | 'in_progress' | 'completed';
  sessionId: number | null;
  questionCount: number;
}

// Mistakes / achievements / stats / leaderboard -------------------------------

export interface MistakeItem {
  questionRef: string;
  skillId: string;
  skillTitle: string;
  lastWrongAt: string;
}

export interface MistakesResponse {
  count: number;
  items: MistakeItem[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { current: number; target: number };
}

export interface AchievementsResponse {
  achievements: Achievement[];
}

export interface SkillStats {
  skillId: string;
  title: string;
  level: number;
  ability: number;
  accuracy: number;
  strength: number;
  started: boolean;
}

export interface StatsResponse {
  xpTotal: number;
  answered: number;
  accuracy: number;
  lessonsCompleted: number;
  longestStreak: number;
  last7Days: { date: string; xp: number }[];
  skills: SkillStats[];
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  xp: number;
  isMe: boolean;
}

export interface LeaderboardResponse {
  weekStart: string;
  entries: LeaderboardEntry[];
  me: { rank: number; xp: number };
}

export interface HealthResponse {
  ok: true;
}
