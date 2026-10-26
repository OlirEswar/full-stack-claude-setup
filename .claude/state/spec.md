# Spec: "Loopy": a Duolingo-style trainer for control theory

## What it is

A gamified, mobile-first micro-learning app for undergrad and grad engineering students. v1 covers one topic, **control theory**. Users move along a skill path (units, then skills, then lessons) and answer fast questions: seconds to about 1 minute each, never problem-set length. A ~3-minute **daily challenge** keeps the habit going. Difficulty adapts per skill using an Elo/IRT-style ability rating. Spaced repetition decides which skills are due. Progress lives on the server, so it syncs between a phone (Expo Go) and a desktop browser (react-native-web).

**Tone / audience:** Duolingo for engineers. The app should feel playful, encouraging, and bright: bold colors, chunky rounded buttons, celebratory feedback, a friendly voice ("Nice, that's a textbook ζ = 0.7!"). It also has to stay credible to engineering students. Math must be crisp and legible, figures look like real plots, copy is precise and never childish or condescending. Think "a smart TA who's fun," not "a kids' game."

Working name: **Loopy** (as in feedback loop). The frontend may change it.

## Fixed architecture (do not change)

- Monorepo with npm workspaces at the root: `server/` (backend) and `client/` (frontend). The root `package.json` has scripts `test`, `typecheck`, `lint` that run across both workspaces (`npm run <x> --workspaces --if-present`).
- **server/**: Node 22, TypeScript, Fastify, `@fastify/cors` (CORS enabled for all origins in dev). SQLite through the built-in `node:sqlite` (`DatabaseSync`), with no native deps. Vitest for tests; routes are tested with `app.inject`. ESLint (flat config, typescript-eslint).
  - App factory: `buildApp({ dbPath, now?, rng? })` in `server/src/app.ts`. `dbPath` accepts `':memory:'` for tests. `now: () => Date` and `rng: () => number` are injectable so streaks, hearts, dates, and random question generation are deterministic in tests. `server/src/index.ts` listens on `PORT` (default 3000), host `0.0.0.0` (so phones on the LAN can reach it), DB file `DB_PATH` (default `server/data/loopy.db`).
  - Known pitfall: on Node < 22.13, `node:sqlite` needs `--experimental-sqlite`. If Vitest/Vite fails to resolve `node:sqlite` as a builtin, load it via `createRequire(import.meta.url)('node:sqlite')` in the db module, or use `pool: 'forks'` with the flag in `execArgv`.
- **client/**: Expo (latest SDK, via `create-expo-app`), Expo Router, TypeScript, react-native-web, react-native-svg. Runs on phones via Expo Go and in a browser via `expo start --web`. `npx expo export --platform web` must succeed. Tests use jest-expo and @testing-library/react-native, with `fetch` mocked; tests never need a running server.
  - No shadcn/Tailwind/next-font: this is React Native. The design system lives in `.claude/state/design-system.md` and is implemented as TS tokens in `client/src/theme/tokens.ts`. Fonts come from `@expo-google-fonts/*` npm packages (npm is reachable), loaded with `expo-font`.
  - API base URL is `process.env.EXPO_PUBLIC_API_URL`, defaulting to `http://localhost:3000`.
  - Token storage: `expo-secure-store` on native, `localStorage` on web, behind one `tokenStorage` module.
  - Headless environment: no Playwright browser downloads are possible. Frontend verification is jest component tests plus a successful `expo export --platform web`.
- No external APIs or LLMs at runtime. All content is local TypeScript modules in `server/src/content/`.

## Core user flows

1. **Sign up / log in**: username + password. The client stores the bearer token. The device timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) is sent at registration and updated via `PATCH /api/me` if it changes.
2. **Home / path**: a vertical skill path grouped by unit. Each skill node shows its crown level (0–5), whether it's locked, and a "due" badge. The top bar shows streak, hearts, and XP-today against the daily goal. A prominent Daily Challenge card sits at the top.
3. **Lesson**: tap an unlocked skill and start an 8-question lesson. The loop is question → Check → feedback sheet (correct/incorrect, correct answer, short explanation, combo) → Continue. A wrong answer costs a heart. At 0 hearts the lesson fails. Finishing shows the session summary.
4. **Daily challenge**: 5 questions (~3 min) drawn from due + weak skills at adaptive difficulty, no hearts. One per calendar day in the user's timezone. Completing it extends the streak.
5. **Practice mistakes**: review previously-missed questions (generators are re-rolled with fresh numbers). Each correct answer clears that mistake. Completing any practice session refills 1 heart.
6. **Session summary**: XP earned (with breakdown), accuracy, max combo, streak (with an "extended!" state), daily goal progress, level-ups, newly unlocked achievements.
7. **Profile / stats**: totals, last-7-days XP bars, per-skill level / ability / accuracy / strength, settings (daily goal, logout).
8. **Leaderboard**: weekly XP (ISO week, Monday 00:00 UTC), top 50 plus your own rank.
9. **Achievements**: grid of locked/unlocked badges with progress.

## Curriculum (path order is global skill order)

| Unit | Skills (id: title) |
|---|---|
| U1 Laplace & Transfer Functions | `laplace-basics`: Laplace basics; `transfer-functions`: Transfer functions; `poles-zeros`: Poles & zeros |
| U2 Block Diagrams | `block-diagrams`: Block diagram algebra |
| U3 First-Order Response | `first-order`: First-order systems |
| U4 Second-Order Response | `second-order-params`: ζ, ωn & damping; `second-order-specs`: Overshoot, settling & peak time |
| U5 Stability | `stability-poles`: Stability & pole locations; `routh-hurwitz`: Routh–Hurwitz |
| U6 Steady-State Error | `system-type`: System type; `steady-state-error`: Steady-state error |
| U7 Root Locus | `root-locus`: Root locus |
| U8 Frequency Response | `frequency-response`: Frequency response; `bode-plots`: Bode plots |
| U9 Nyquist & Margins | `nyquist`: Nyquist criterion; `stability-margins`: Gain & phase margins |
| U10 PID Control | `pid-control`: P, PI, PD & PID |
| U11 State Space | `state-space-models`: State-space models; `ss-eigenvalues`: Eigenvalues & stability; `controllability-observability`: Controllability & observability |

That's 20 skills. Content targets: **≥8 static items per skill (≥160 total, hard floor 150)**, spanning at least 3 distinct difficulty levels per skill. **≥15 parameterized generators** (19 planned; see tasks.md).

### Question model (server/src/content/types.ts)

```ts
type Difficulty = 1 | 2 | 3 | 4 | 5;
type FigureSpec =
  | { type: 'pole_zero'; poles: {re:number; im:number}[]; zeros: {re:number; im:number}[] }
  | { type: 'step_response'; points: [number, number][]; finalValue?: number; xLabel?: string; yLabel?: string }
  | { type: 'bode_mag'; points: [number, number][] /* [ω rad/s, dB], ω log-spaced */; asymptotes?: [number, number][] };
interface Base { id: string; skillId: string; difficulty: Difficulty; prompt: string; explanation: string; figure?: FigureSpec }
type StaticQuestion = Base & (
  | { kind: 'mcq'; choices: string[]; answer: number }
  | { kind: 'true_false'; answer: boolean }
  | { kind: 'numeric'; answer: number; tolerance: { abs?: number; rel?: number }; unit?: string }
  | { kind: 'multi_select'; choices: string[]; answer: number[] }
  | { kind: 'match'; left: string[]; right: string[]; answer: number[] /* left i ↔ right answer[i] */ });
interface Generator { id: string; skillId: string; difficulties: Difficulty[]; generate(rng: () => number, d: Difficulty): Omit<StaticQuestion, 'id'> }
```

- Math is Unicode plain text only (s², ζ, ωn, ∞, √, →, ≤). No LaTeX: a content validator rejects `\`, `$`, `^{`, `_{`.
- Explanations are 1–3 sentences. Prompts are answerable in ≤ 60 s without a calculator beyond simple arithmetic. Generators pick "nice" numbers.
- Numeric default tolerance is `rel: 0.02` unless the item specifies otherwise.
- Instantiated questions (static or generated) get stable ids: static `"<skillId>/<slug>"`, generated `"gen:<generatorId>"` plus stored params.

### Client-safe question (what the client receives; never contains the answer)

```ts
interface ClientQuestion {
  itemId: number; position: number; total: number; skillId: string; difficulty: Difficulty;
  kind: 'mcq'|'true_false'|'numeric'|'multi_select'|'match';
  prompt: string; figure?: FigureSpec;
  choices?: string[];            // mcq, multi_select (server-shuffled)
  left?: string[]; right?: string[]; // match (right side server-shuffled)
  unit?: string;                 // numeric
}
```

Responses: mcq `{choice:number}`, true_false `{value:boolean}`, numeric `{value:number}`, multi_select `{choices:number[]}`, match `{pairs:number[]}` (pairs[i] = index into displayed `right`). Indices refer to the displayed (shuffled) order. The server stores the answer key in display order.

## Adaptive engine (pure functions, server/src/engine/)

- **Ability**: per (user, skill) θ, default 0, clamped to [−4, 4]. Item difficulty d ∈ 1..5 maps to b = d − 3.
- Expected success: `P = 1 / (1 + e^(−(θ − b)))`.
- Update after each answer: `θ' = θ + K·(o − P)`, with o ∈ {0,1} and `K = max(0.3, 1.2 / (1 + n/10))`, where n = prior attempts on that skill.
- **Selection**: target P = 0.75. `pickDifficulty(θ, available)` returns the available d minimizing |P(θ,d) − 0.75| (ties go to the lower d). Within that difficulty, pick randomly (injected rng) among generator instances and static items. Exclude static items this user answered in the last 3 days, and items already used in this session; fall back to d±1 when exhausted. When a generator exists for the skill/difficulty, prefer it about 40% of the time.
- **Spaced repetition** per (user, skill): `halfLifeDays` (default 1), `lastPracticedAt`, `nextDueAt`. `strength(now) = 2^(−Δdays / halfLife)`. After a completed session, using that skill's accuracy a in the session: a ≥ 0.8 doubles the half-life (max 60); 0.5 ≤ a < 0.8 keeps it; a < 0.5 halves it (min 0.5). `nextDueAt = now + halfLife days`. A skill is **due** when it has been started (attempts > 0) and now ≥ nextDueAt. **Weak** skills are started skills ordered by ascending θ.
- **Daily selection**: up to 3 due skills (most overdue first), filled with the weakest skills, 5 questions total, each at `pickDifficulty(θ_skill)`. A user with no started skills gets the first unlocked skill.

## Gamification rules

- **XP**, recorded as `xp_events` rows with the user's local date:
  - Lesson: 10 on completion, +5 if perfect.
  - Practice or mistakes: 10, +5 if perfect.
  - Daily challenge: 15, +5 if perfect.
  - Combo bonus: +2 every time the in-session combo hits a multiple of 5.
  - A failed lesson awards 0 XP.
- **Daily XP goal**: one of 10/20/30/50, default 20. `dailyGoalMet` when XP for the local date ≥ goal.
- **Hearts**: max 5, only in `lesson` sessions. −1 per wrong answer. At 0 hearts the session becomes `failed`. Hearts regenerate +1 per 30 min (computed lazily from `hearts_updated_at`). Completing a practice or mistakes session gives +1 heart. You can't start a lesson with 0 hearts (409).
- **Crowns / levels**: skill level 0–5. Each level needs 3 completed (non-failed) lessons. Skill i is unlocked if i = 0 or skill i−1 has level ≥ 1.
- **Streak**: counted on daily-challenge completion for local date D.
  - last = D: no change.
  - last = D−1: streak + 1.
  - Gap of g missed days with freezes ≥ g: consume g freezes, then streak + 1.
  - Otherwise: streak = 1.
  - Displayed streak is 0 if the gap can't be covered by freezes.
  - Earn +1 freeze each time the streak reaches a multiple of 7 (max 2 held).
- **Combo**: consecutive correct answers in a session. Returned on every answer; the client animates it at 3+.
- **Achievements** (id: condition): `first-steps` complete a lesson; `streak-3`, `streak-7`, `streak-30`; `perfectionist` perfect lesson; `combo-10`; `sharpshooter` 100 correct answers; `xp-500`; `xp-2000`; `stable-genius` level ≥1 in both U5 skills; `bode-boss` level ≥3 in `bode-plots`; `full-state` level ≥1 in all U11 skills; `mistake-mender` clear 10 mistakes; `legendary` any skill level 5. Each achievement exposes `{current, target}` progress.
- **Feedback**: animated correct/incorrect sheet, combo flame, XP count-up, and level-up/streak celebrations (react-native `Animated`/Reanimated). Haptics via `expo-haptics` on native. v1 ships no audio assets; sound is out of scope.

## Data model (SQLite, migrations in server/src/db/migrations.ts, tracked by `schema_migrations`)

- `users(id PK, username UNIQUE COLLATE NOCASE, password_hash, password_salt, timezone DEFAULT 'UTC', daily_xp_goal DEFAULT 20, created_at)`
- `auth_tokens(token_hash PK, user_id FK, created_at, expires_at)`: stores the sha256 of a 32-byte random token. 30-day expiry.
- `user_stats(user_id PK, xp_total, hearts, hearts_updated_at, streak_current, streak_longest, streak_last_date, streak_freezes, correct_total, answered_total, lessons_completed, mistakes_cleared)`
- `skill_progress(user_id, skill_id, ability, attempts, correct, level, lessons_in_level, half_life_days, last_practiced_at, next_due_at, PK(user_id, skill_id))`
- `sessions(id PK, user_id, kind CHECK IN('lesson','practice','mistakes','daily'), skill_id NULL, status CHECK IN('active','failed','completed'), total, combo, max_combo, hearts_lost, xp_earned, local_date, started_at, completed_at)`
- `session_items(id PK, session_id, position, question_ref, skill_id, difficulty, client_payload JSON, answer_key JSON, explanation, response JSON NULL, correct NULL, time_ms NULL, answered_at NULL)`
- `mistakes(id PK, user_id, question_ref, skill_id, wrong_count, last_wrong_at, cleared_at NULL, UNIQUE(user_id, question_ref))`. For generated items, `question_ref` = `gen:<id>`.
- `xp_events(id PK, user_id, amount, source, session_id, local_date, created_at)`, indexed on (user_id, local_date) and created_at.
- `daily_challenges(user_id, local_date, session_id, completed_at NULL, PK(user_id, local_date))`
- `user_achievements(user_id, achievement_id, unlocked_at, PK(user_id, achievement_id))`

Content (units/skills/questions/generators) is **not** stored in the DB. It is an in-memory registry built from TS modules.

## API surface (JSON; all `/api/*` except auth require `Authorization: Bearer <token>`, else 401)

| Method & path | Body | Response |
|---|---|---|
| GET /health | n/a | `{ok:true}` |
| POST /api/auth/register | `{username, password, timezone?}` | 201 `{token, user}`. 400 invalid (username `^[a-zA-Z0-9_]{3,20}$`, password ≥ 8), 409 taken |
| POST /api/auth/login | `{username, password}` | 200 `{token, user}`, 401 bad creds |
| POST /api/auth/logout | n/a | 204, token revoked |
| GET /api/me | n/a | `{user:{id,username,timezone,dailyXpGoal}, stats:{xpTotal,xpToday,dailyXpGoal,dailyGoalMet,streak,longestStreak,streakFreezes,hearts,maxHearts:5,nextHeartAt|null,dailyChallengeDone}}` |
| PATCH /api/me | `{timezone?, dailyXpGoal?}` | same as GET /api/me; 400 on invalid tz/goal |
| GET /api/path | n/a | `{units:[{id,title,description,skills:[{id,title,level,maxLevel:5,lessonsInLevel,lessonsPerLevel:3,unlocked,started,due,strength}]}]}` |
| POST /api/sessions | `{kind:'lesson',skillId}` \| `{kind:'practice'}` \| `{kind:'mistakes'}` | 201 `{session:{id,kind,skillId,total,status,hearts}, question:ClientQuestion}`. 404 unknown skill, 403 locked, 409 no hearts / no mistakes |
| GET /api/sessions/:id | n/a | `{session, question:ClientQuestion|null, answered:number}` (resume) |
| POST /api/sessions/:id/answer | `{itemId, response, timeMs}` | `{correct, correctAnswer, correctAnswerText, explanation, combo, hearts, comboBonusXp, status:'active'|'failed'|'ready', next:ClientQuestion|null}`. 400 bad shape, 409 already answered / wrong item / session not active |
| POST /api/sessions/:id/complete | n/a | `{xpEarned, xpBreakdown:[{label,amount}], correct, total, accuracy, maxCombo, perfect, streak, streakExtended, dailyGoalMet, xpToday, levelUp:{skillId,level}|null, newAchievements:[{id,title}]}`. 409 unless all items answered (or already completed: returns stored summary idempotently) |
| GET /api/daily | n/a | `{date, status:'not_started'|'in_progress'|'completed', sessionId|null, questionCount:5}` |
| POST /api/daily/start | n/a | 201 same shape as POST /api/sessions (resumes the in-progress session if one exists). 409 if completed today |
| GET /api/mistakes | n/a | `{count, items:[{questionRef, skillId, skillTitle, lastWrongAt}]}` |
| GET /api/achievements | n/a | `{achievements:[{id,title,description,icon,unlocked,unlockedAt|null,progress:{current,target}}]}` |
| GET /api/stats | n/a | `{xpTotal, answered, accuracy, lessonsCompleted, longestStreak, last7Days:[{date,xp}], skills:[{skillId,title,level,ability,accuracy,strength,started}]}` |
| GET /api/leaderboard | n/a | `{weekStart, entries:[{rank,username,xp,isMe}] (top 50, xp desc, ties by username), me:{rank,xp}}` |

Session sizes: lesson 8, practice 8, mistakes ≤ 8, daily 5. Practice draws from due skills, falling back to weak ones.

## Screens (Expo Router, client/app/)

- `(auth)/login.tsx`, `(auth)/register.tsx`
- `(tabs)/_layout.tsx` with tabs Learn / Leaderboard / Achievements / Profile
- `(tabs)/index.tsx` home/path: top stat bar, daily challenge card, practice-mistakes entry, skill path
- `(tabs)/leaderboard.tsx`, `(tabs)/achievements.tsx`, `(tabs)/profile.tsx`
- `daily.tsx`: daily challenge intro/status, which then starts the player
- `session/[id].tsx`: the player (progress bar, hearts, combo, question renderer, Check button, feedback sheet)
- `session/summary.tsx`: summary (receives the completion payload)

Layout must work on a narrow phone (360 px) and a desktop browser. On wide screens, content is centered with a max width of about 640 px.

## Out of scope for v1

Topics other than control theory, social features beyond the leaderboard, payments/gems shop, audio, push notifications, offline mode, admin/content editor, LaTeX.
