# Tasks: Loopy (control-theory Duolingo)

Work top to bottom. Read `.claude/state/spec.md` for the data model, API shapes, and rules. A task is done only when its acceptance criterion passes **and** the root `npm test`, `npm run typecheck`, and `npm run lint` stay green. Server test files live in `server/test/`. Each listed `describe`/`it` name must exist and pass.

---

## Backend foundations

- [x] **1. [backend] Monorepo + server scaffold**
  - Files: `package.json` (root: `"workspaces": ["server","client"]`, scripts `test`/`typecheck`/`lint` = `npm run <x> --workspaces --if-present`), `.gitignore` (node_modules, `server/data/`, `client/dist/`, `.expo/`), `server/package.json`, `server/tsconfig.json`, `server/eslint.config.js`, `server/vitest.config.ts`, `server/src/app.ts` (`buildApp({dbPath, now?, rng?})`), `server/src/index.ts`, `server/test/health.test.ts`.
  - Server scripts: `dev` (tsx watch), `start`, `test` (vitest run), `typecheck` (tsc --noEmit), `lint` (eslint .). Register `@fastify/cors` with origin `true`.
  - Acceptance: from the repo root, `npm install && npm test && npm run typecheck && npm run lint` all exit 0. `health.test.ts` › `GET /health returns 200 {ok:true}` passes. `health.test.ts` › `sets access-control-allow-origin` passes (an inject with an `Origin` header gets the CORS header back).

- [x] **2. [backend] SQLite layer + migrations**
  - Files: `server/src/db/index.ts` (`openDb(path)` using `node:sqlite` DatabaseSync; enable foreign keys + WAL for file DBs), `server/src/db/migrations.ts` (all tables from spec "Data model" + `schema_migrations`), `server/test/db.test.ts`. Wire `openDb` into `buildApp` (decorate `app.db`).
  - Acceptance: `npm test -w server -- db` passes these tests:
    - `creates all tables` (checks sqlite_master for users, auth_tokens, user_stats, skill_progress, sessions, session_items, mistakes, xp_events, daily_challenges, user_achievements, schema_migrations)
    - `migrations are idempotent` (running twice leaves one row per version)
    - `enforces unique username case-insensitively`

- [x] **3. [backend] Auth: register/login/logout/me + auth hook**
  - Files: `server/src/auth/password.ts` (scrypt via node:crypto, random 16-byte salt, timingSafeEqual), `server/src/auth/tokens.ts`, `server/src/auth/plugin.ts` (preHandler decorating `request.user`), `server/src/routes/auth.ts`, `server/src/routes/me.ts` (GET/PATCH /api/me; stats fields may be computed from user_stats defaults for now), `server/test/auth.test.ts`.
  - Registration creates the `user_stats` row (hearts 5, streak 0).
  - Acceptance: `npm test -w server -- auth` passes:
    - `register returns 201 with token`
    - `register rejects duplicate username with 409`
    - `register rejects short password with 400`
    - `login with wrong password returns 401`
    - `GET /api/me without token returns 401`
    - `GET /api/me with token returns username and stats.hearts === 5`
    - `logout revokes token` (subsequent /api/me returns 401)
    - `PATCH /api/me rejects dailyXpGoal 15 with 400 and accepts 30`
    - `password hash is not stored in plaintext`

- [x] **4. [backend] Content model, curriculum, grading, sanitizer, validator**
  - Files: `server/src/content/types.ts` (types exactly as in spec), `server/src/content/curriculum.ts` (11 units, 20 skills, ids/titles/order from spec, with a short unit description each), `server/src/content/registry.ts` (collects static items + generators from `server/src/content/units/*.ts`; exposes `getSkill`, `staticItemsFor(skillId, d?)`, `generatorsFor(skillId, d?)`, `allStatic()`, `allGenerators()`), `server/src/content/rng.ts` (seedable mulberry32 + helpers `int`, `pick`, `shuffle`), `server/src/content/grade.ts` (`grade(kind, answerKey, response)` with numeric tolerance abs/rel, default rel 0.02; order-insensitive multi_select; exact match pairs), `server/src/content/present.ts` (`toClientQuestion(instance, rng)` that shuffles choices/right side and returns `{client, answerKey}` with the key remapped to display order, plus `answerText(...)` for human-readable correct answers), `server/src/content/validate.ts` (`validateQuestion(q)` returns an error list: no LaTeX chars `\ $ ^{ _{`, non-empty prompt/explanation ≤ 300 chars, answer indices in range, mcq ≥ 3 choices, match left/right same length, valid figure spec, numeric answer finite), `server/src/content/units/` (empty index plus 2 sample fixture items in `units/_fixtures.ts` used only by tests), `server/test/content-core.test.ts`.
  - Acceptance: `npm test -w server -- content-core` passes:
    - `curriculum has 11 units and 20 skills in path order`
    - `grade numeric respects relative tolerance` (answer 10, rel 0.02: 10.19 correct, 10.3 wrong)
    - `grade numeric respects absolute tolerance`
    - `grade multi_select is order-insensitive and rejects partial`
    - `grade match requires all pairs`
    - `toClientQuestion never includes answer fields` (serialize client payload; assert no `answer` key)
    - `shuffled mcq answer key still grades the right displayed choice`
    - `validateQuestion rejects LaTeX`
    - `rng is deterministic for a given seed`

- [x] **5. [backend] Content pack A: U1–U3 (laplace-basics, transfer-functions, poles-zeros, block-diagrams, first-order)**
  - Files: `server/src/content/units/u01-laplace.ts`, `u02-block-diagrams.ts`, `u03-first-order.ts`, register them in `units/index.ts`, `server/test/content-pack-a.test.ts`.
  - ≥8 static items per skill (≥40 total) mixing all 5 kinds across the pack, ≥3 difficulty levels per skill. At least 2 items with a `pole_zero` figure and 2 with a `step_response` figure (first-order curves).
  - Generators (5): `laplace-pair` (mcq: transform of e^(−at), t·e^(−at), sin ωt with random a/ω, plausible distractors), `final-value` (numeric: final value theorem of a step into K·a/(s+a)-style TF), `tf-poles` (numeric/mcq: poles of s² + bs + c with integer roots), `block-feedback` (numeric: closed-loop gain G/(1+GH) with constants), `first-order-tau` (numeric: τ, 2% settling ≈ 4τ, or y(τ) ≈ 0.632·K).
  - Acceptance: `npm test -w server -- content-pack-a` passes:
    - `every pack-A static item passes validateQuestion`
    - `each pack-A skill has >= 8 static items across >= 3 difficulties`
    - `each pack-A generator produces valid self-grading questions for 200 seeds` (for each seed: validate, then grading the generator's own answer returns correct)
    - `pack-A generators vary their numbers across seeds` (≥ 5 distinct prompts in 20 seeds)

- [x] **6. [backend] Content pack B: U4–U6 (second-order-params, second-order-specs, stability-poles, routh-hurwitz, system-type, steady-state-error)**
  - Files: `server/src/content/units/u04-second-order.ts`, `u05-stability.ts`, `u06-steady-state-error.ts`, `units/index.ts`, `server/test/content-pack-b.test.ts`.
  - ≥8 static items per skill (≥48 total), ≥3 difficulties per skill, all 5 kinds used in the pack. Include ≥3 `step_response` figures (underdamped/critically/overdamped, used for "which ζ?" items) and ≥3 `pole_zero` figures (stability classification).
  - Generators (9): `second-order-wn-zeta` (given ωn²/(s² + 2ζωn·s + ωn²) with numbers, compute ωn or ζ), `percent-overshoot` (%OS = 100·e^(−ζπ/√(1−ζ²))), `settling-time` (Ts ≈ 4/(ζωn)), `peak-time` (Tp = π/(ωn√(1−ζ²))), `stability-from-poles` (mcq stable/marginal/unstable with a pole_zero figure), `routh-k-range` (s³ + a·s² + b·s + K: K_max = a·b), `system-type` (mcq: count of free integrators in G(s)), `ss-error-step` (e = 1/(1+Kp)), `ss-error-ramp` (e = 1/Kv).
  - Acceptance: `npm test -w server -- content-pack-b` passes tests with the same four names as pack A, with `pack-B` in place of `pack-A`.

- [x] **7. [backend] Content pack C: U7–U9 (root-locus, frequency-response, bode-plots, nyquist, stability-margins)**
  - Files: `server/src/content/units/u07-root-locus.ts`, `u08-frequency-response.ts`, `u09-nyquist-margins.ts`, `units/index.ts`, `server/test/content-pack-c.test.ts`.
  - ≥8 static items per skill (≥40 total), ≥3 difficulties per skill. Include ≥4 `bode_mag` figures (read DC gain, corner frequency, slope) and ≥2 `pole_zero` figures (root-locus start/end points).
  - Generators (3): `root-locus-centroid` (asymptote centroid (Σp − Σz)/(n − m) and angles), `bode-dc-gain` (20·log10 K for K/(s/p + 1), or slope after N poles = −20N dB/dec), `gain-margin-db` (GM = 20·log10(1/|G(jω180)|) from a given magnitude).
  - Acceptance: `npm test -w server -- content-pack-c` passes the four tests named as in pack A, with `pack-C`.

- [x] **8. [backend] Content pack D: U10–U11 (pid-control, state-space-models, ss-eigenvalues, controllability-observability) + global content totals**
  - Files: `server/src/content/units/u10-pid.ts`, `u11-state-space.ts`, `units/index.ts`, `server/test/content-pack-d.test.ts`, `server/test/content-totals.test.ts`.
  - ≥8 static items per skill (≥32 total). Use `match` items for PID term ↔ effect. Include ≥1 `step_response` figure comparing P vs PI behaviour.
  - Generators (2): `ss-eigenvalues-2x2` (eigenvalues of a 2×2 A with integer eigenvalues, via trace/determinant), `controllability-2x2` (true_false: rank of [B AB]).
  - Acceptance:
    - `npm test -w server -- content-pack-d` passes the four tests named as in pack A, with `pack-D`.
    - `npm test -w server -- content-totals` passes:
      - `at least 150 static items in total`
      - `at least 15 generators in total`
      - `every one of the 20 skills has >= 8 static items`
      - `static item ids are unique`
      - `every question kind appears at least 10 times`
      - `at least 15 items carry a figure`

## Backend engine & gameplay

- [x] **9. [backend] Adaptive engine + spaced repetition (pure functions)**
  - Files: `server/src/engine/ability.ts` (`expectedSuccess`, `updateAbility`, `pickDifficulty`), `server/src/engine/spaced.ts` (`strength`, `scheduleAfterSession`, `isDue`), `server/src/engine/select.ts` (`selectQuestionsForSkill(ctx, skillId, count)`, `selectDaily(ctx)`, `selectPractice(ctx)`; `ctx` provides progress map, recently-seen static ids, rng), `server/test/engine.test.ts`.
  - Formulas exactly as in spec "Adaptive engine".
  - Acceptance: `npm test -w server -- engine` passes:
    - `expectedSuccess(0, 3) === 0.5`
    - `pickDifficulty(0, [1..5]) returns 2`
    - `pickDifficulty(2, [1..5]) returns 4`
    - `correct answer raises ability, wrong lowers it`
    - `K shrinks with attempts and floors at 0.3`
    - `ability is clamped to [-4, 4]`
    - `strength halves after one half-life`
    - `accuracy >= 0.8 doubles half-life, < 0.5 halves it, capped to [0.5, 60]`
    - `simulated learner converges to ~75% success` (simulate a learner with true θ = 1.5 over 300 answers with a seeded rng; the observed success rate over the last 100 answers is in [0.65, 0.85])
    - `selectQuestionsForSkill excludes static items seen in last 3 days when pool allows`
    - `selectDaily returns 5 questions from due skills first, then weakest`
    - `selectDaily for a new user uses the first skill`

- [x] **10. [backend] Path endpoint + skill progress service**
  - Files: `server/src/services/progress.ts` (get/upsert skill_progress, unlock logic, due/strength), `server/src/routes/path.ts`, `server/test/path.test.ts`.
  - Acceptance: `npm test -w server -- path` passes:
    - `new user sees only first skill unlocked`
    - `skill 2 unlocks when skill 1 reaches level 1` (seed skill_progress directly)
    - `due flag reflects next_due_at vs injected now`
    - `path returns 11 units with skills in curriculum order`

- [x] **11. [backend] Sessions: start, fetch, answer (server-side grading, hearts, combo, ability, mistakes)**
  - Files: `server/src/services/sessions.ts`, `server/src/services/hearts.ts` (lazy regen +1/30 min, max 5), `server/src/routes/sessions.ts` (POST /api/sessions, GET /api/sessions/:id, POST /api/sessions/:id/answer), `server/test/sessions.test.ts`.
  - On start: select items via engine, instantiate generators with rng, store `client_payload` + `answer_key` in session_items. Return the first ClientQuestion. On answer: grade, update θ/attempts/correct on skill_progress, combo/max_combo, hearts (lesson only), upsert mistakes on wrong (clear on correct in a `mistakes` session, incrementing `user_stats.mistakes_cleared`), and record answered/correct totals in user_stats. Also: ownership check (another user's session gives 404). Leave practice/mistakes kinds returning 501 if task 14 isn't done yet.
  - Acceptance: `npm test -w server -- sessions` passes:
    - `starting a lesson returns 8-question session and a ClientQuestion without answer`
    - `no session_items client_payload contains the answer key`
    - `locked skill returns 403, unknown skill 404`
    - `correct answer returns correct:true, explanation, combo 1`
    - `wrong answer in lesson costs a heart and records a mistake`
    - `losing 5 hearts fails the lesson and further answers return 409`
    - `cannot start a lesson with 0 hearts (409)`
    - `hearts regenerate one per 30 minutes using injected clock`
    - `answering same item twice returns 409`
    - `other user's session returns 404`
    - `ability for the skill changes after answering`
    - `GET /api/sessions/:id resumes at the next unanswered question`

- [x] **12. [backend] Session completion: XP, levels/crowns, spaced-rep scheduling, daily goal**
  - Files: `server/src/services/complete.ts`, `server/src/services/xp.ts` (local-date helper via `Intl.DateTimeFormat('en-CA', {timeZone})`, xp_events insert, xpToday), `server/src/routes/sessions.ts` (POST /api/sessions/:id/complete), `server/src/routes/me.ts` (real xpToday/dailyGoalMet/hearts/nextHeartAt), `server/test/complete.test.ts`.
  - Acceptance: `npm test -w server -- complete` passes:
    - `completing a perfect lesson awards 15 XP with breakdown`
    - `combo bonus adds 2 XP at combo 5`
    - `failed lesson awards 0 XP and no level progress`
    - `3 completed lessons raise skill level from 0 to 1`
    - `level caps at 5`
    - `complete before all items answered returns 409`
    - `complete is idempotent (second call returns same summary, no extra XP)`
    - `half-life and next_due_at updated for practiced skills`
    - `xpToday uses the user's timezone` (user in `Pacific/Auckland`, event near UTC midnight)
    - `dailyGoalMet true once xpToday >= dailyXpGoal`

- [x] **13. [backend] Daily challenge + streak + streak freeze**
  - Files: `server/src/services/streak.ts` (pure `applyStreak(state, localDate)` + `displayStreak(state, today)`), `server/src/services/daily.ts`, `server/src/routes/daily.ts` (GET /api/daily, POST /api/daily/start), hook into completion for kind `daily` (15 XP, +5 perfect, `streakExtended`), `server/test/daily.test.ts`, `server/test/streak.test.ts`.
  - Acceptance: `npm test -w server -- daily streak` passes:
    - `daily start returns 5 questions and no hearts are consumed on wrong answers`
    - `daily start twice the same day resumes the same session`
    - `daily start after completion returns 409`
    - `GET /api/daily status transitions not_started → in_progress → completed`
    - `new calendar day in user timezone allows a new daily`
    - `consecutive days increment streak`
    - `missing a day with a freeze keeps the streak and consumes the freeze`
    - `missing a day without freeze resets streak to 1`
    - `reaching streak 7 grants a freeze, max 2 held`
    - `displayed streak is 0 when the gap cannot be covered`
    - `completing daily sets streakExtended true and updates longest streak`

- [x] **14. [backend] Practice + mistakes sessions**
  - Files: `server/src/services/sessions.ts` (kinds `practice` and `mistakes`), `server/src/routes/mistakes.ts` (GET /api/mistakes), `server/test/practice.test.ts`.
  - Mistakes session: up to 8 uncleared mistakes, oldest first. Generated refs are re-instantiated with a fresh seed. A correct answer clears the mistake. Practice: 8 items from due skills, falling back to weak skills. Completing either gives +1 heart (max 5) and 10 XP (+5 perfect).
  - Acceptance: `npm test -w server -- practice` passes:
    - `mistakes session with no mistakes returns 409`
    - `mistakes session contains previously missed questions`
    - `generated mistake is re-rolled with different numbers`
    - `correct answer in mistakes session clears the mistake`
    - `GET /api/mistakes lists uncleared mistakes with skill titles`
    - `completing practice refills one heart`
    - `practice session does not cost hearts`

- [ ] **15. [backend] Achievements**
  - Files: `server/src/content/achievements.ts` (14 definitions from spec with `progress(stats)` fns), `server/src/services/achievements.ts` (`evaluate(userId)` returns newly unlocked; called from completion), `server/src/routes/achievements.ts`, `server/test/achievements.test.ts`.
  - Acceptance: `npm test -w server -- achievements` passes:
    - `GET /api/achievements returns all 14 with progress`
    - `first lesson completion unlocks first-steps and returns it in newAchievements`
    - `perfect lesson unlocks perfectionist`
    - `achievements are only unlocked once`
    - `streak-7 progress reports {current, target: 7}`

- [x] **16. [backend] Stats + weekly leaderboard**
  - Files: `server/src/routes/stats.ts`, `server/src/routes/leaderboard.ts`, `server/src/services/leaderboard.ts` (ISO week start, Monday 00:00 UTC), `server/test/stats.test.ts`, `server/test/leaderboard.test.ts`.
  - Acceptance: `npm test -w server -- stats leaderboard` passes:
    - `stats returns last7Days with 7 entries and zero-filled days`
    - `stats accuracy equals correct/answered`
    - `stats lists all 20 skills with level and strength`
    - `leaderboard sums only this week's XP`
    - `leaderboard orders by xp desc then username and caps at 50`
    - `leaderboard me shows rank even with 0 XP`
    - `leaderboard isMe flags the caller`

- [ ] **17. [backend] Dev seed script + end-to-end API smoke test**
  - Files: `server/src/scripts/seed-demo.ts` (creates `demo`/`demopass1` with some progress plus 5 fake leaderboard users), server script `seed`, `server/test/e2e-flow.test.ts`.
  - Acceptance: `npm test -w server -- e2e-flow` passes `full flow: register → path → lesson (answer all) → complete → daily → complete → me shows streak 1 and xp > 0 → leaderboard rank 1`. `npm run seed -w server` exits 0 against a temp `DB_PATH`.

## Frontend

- [x] **18. [frontend] Expo client scaffold in the workspace**
  - Files: `client/` (via `npx create-expo-app@latest client --template default --no-install`, then strip the example screens; delete any `client/package-lock.json` and install from the root), `client/package.json` (scripts `start`, `web`, `test` = `jest`, `typecheck` = `tsc --noEmit`, `lint` = `expo lint`; jest preset `jest-expo`), `client/app/_layout.tsx`, `client/app/index.tsx` (placeholder), `client/src/config.ts` (`API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'`), `client/__tests__/config.test.ts`. Ensure `react-native-svg`, `react-native-web`, `react-dom`, `@expo/metro-runtime`, `expo-secure-store`, `expo-haptics`, `@testing-library/react-native` are installed at SDK-compatible versions (`npx expo install`).
  - Acceptance: from the root, `npm test`, `npm run typecheck`, `npm run lint` exit 0 (both workspaces now run). `cd client && npx expo export --platform web` exits 0 and produces `client/dist/index.html`. The `config.test.ts` › `API_URL defaults to http://localhost:3000` test passes.

- [x] **19. [frontend] Design system + theme tokens + core primitives**
  - Files: `.claude/state/design-system.md` (derived from the spec tone line; RN equivalents: fonts via `@expo-google-fonts/*`, no Tailwind), `client/src/theme/tokens.ts` (colors incl. success/error/warning, streak-orange, xp-gold, heart-red; neutral scale; type scale; radii; spacing; elevation; "3D" bottom-border button style), `client/src/theme/index.ts`, `client/src/components/ui/` (`Button` primary/secondary/ghost/danger with pressed state, `Card`, `ProgressBar`, `StatPill` (streak/hearts/XP), `Screen` (safe area + centered max-width 640 on web), `Text` variants, `EmptyState`, `ErrorState`, `LoadingState`), font loading in `client/app/_layout.tsx`, `client/__tests__/ui.test.tsx`.
  - Acceptance: `npm test -w client -- ui` passes:
    - `Button renders label and fires onPress`
    - `Button disabled does not fire onPress`
    - `ProgressBar exposes accessibilityValue {now, max}`
    - `StatPill renders streak count`
    - `tokens has no stock default palette` (assert the primary color is not `#007AFF`/`#2563eb`/`#3b82f6`)
  - Also `npx expo export --platform web` still exits 0.

- [x] **20. [frontend] API client, types, token storage, auth context**
  - Files: `client/src/api/types.ts` (mirror spec response shapes incl. `ClientQuestion`, `FigureSpec`), `client/src/api/client.ts` (typed fetch wrapper adding the bearer token; throws `ApiError{status, message}`; one function per endpoint in the spec table), `client/src/auth/tokenStorage.ts` (SecureStore native / localStorage web), `client/src/auth/AuthContext.tsx` (`useAuth()`: user, login, register (sends device timezone), logout, loading), `client/__tests__/api.test.ts`.
  - Acceptance: `npm test -w client -- api` passes:
    - `adds Authorization header when token present`
    - `uses EXPO_PUBLIC_API_URL base`
    - `throws ApiError with status on 401`
    - `register sends timezone`
    - `submitAnswer posts {itemId, response, timeMs}`

- [x] **21. [frontend] Auth screens + route guard**
  - Files: `client/app/(auth)/_layout.tsx`, `client/app/(auth)/login.tsx`, `client/app/(auth)/register.tsx`, guard logic in `client/app/_layout.tsx` (unauthenticated → `/login`, authenticated → `/(tabs)`), `client/__tests__/auth-screens.test.tsx`.
  - Acceptance: `npm test -w client -- auth-screens` passes:
    - `login shows validation error for empty fields`
    - `login calls api.login with entered credentials`
    - `register shows 409 as "Username taken"`
    - `register requires password >= 8 chars`

- [x] **22. [frontend] SVG figure renderers**
  - Files: `client/src/components/figures/PoleZeroMap.tsx` (axes, × poles, ○ zeros, auto-scaled, jω/σ labels), `StepResponse.tsx` (polyline, optional dashed final-value line, axes ticks), `BodeMag.tsx` (log-ω axis with decade ticks, dB axis, optional dashed asymptotes), `Figure.tsx` (switch on `figure.type`), `client/__tests__/figures.test.tsx`.
  - Acceptance: `npm test -w client -- figures` passes:
    - `PoleZeroMap renders one marker per pole and zero` (via testIDs `pole-marker`/`zero-marker`)
    - `StepResponse renders a path from points`
    - `BodeMag renders decade tick labels for 0.1–100 rad/s`
    - `Figure returns null for unknown type`

- [x] **23. [frontend] Question input components (all 5 kinds)**
  - Files: `client/src/components/questions/McqInput.tsx`, `TrueFalseInput.tsx`, `NumericInput.tsx` (decimal keypad, accepts `-`, `.`, and `e` notation; shows unit), `MultiSelectInput.tsx`, `MatchInput.tsx` (tap-left-then-right pairing with colored pair chips), `QuestionView.tsx` (prompt + Figure + input; reports `response | null` meaning not-yet-answerable), `client/__tests__/questions.test.tsx`.
  - Acceptance: `npm test -w client -- questions` passes:
    - `McqInput emits {choice} for tapped option`
    - `TrueFalseInput emits {value:false}`
    - `NumericInput emits null for invalid text and {value} for "0.707"`
    - `MultiSelectInput toggles selections into {choices}`
    - `MatchInput emits {pairs} only when all left items are paired`
    - `QuestionView renders figure when present`

- [ ] **24. [frontend] Session player + feedback sheet + summary screen**
  - Files: `client/app/session/[id].tsx`, `client/app/session/summary.tsx`, `client/src/components/session/` (`SessionHeader` with ProgressBar + hearts + close, `FeedbackSheet` with correct/incorrect styles, correct answer text, explanation, Continue; `ComboBadge` animated at ≥3; `XpCountUp`), `client/src/hooks/useSession.ts` (state machine: answering → checking → feedback → next/ready → complete; failed → out-of-hearts screen), haptics on native only (Platform guard), `client/__tests__/session.test.tsx`.
  - Acceptance: `npm test -w client -- session` passes (API mocked):
    - `Check is disabled until an answer is given`
    - `shows FeedbackSheet with explanation after Check`
    - `incorrect answer shows correct answer text`
    - `Continue advances to next question and updates progress`
    - `last answer triggers complete and navigates to summary`
    - `failed status shows out-of-hearts screen`
    - `summary shows XP earned, accuracy and streak-extended banner`

- [ ] **25. [frontend] Tabs + home/path screen**
  - Files: `client/app/(tabs)/_layout.tsx` (Learn / Leaderboard / Achievements / Profile tabs), `client/app/(tabs)/index.tsx`, `client/src/components/path/` (`TopStatsBar`: streak, hearts with next-heart time, XP today vs goal ring; `DailyChallengeCard`; `MistakesCard` (shows count, hidden at 0); `SkillPath`: unit headers + zig-zag skill nodes with crown level, lock, due badge; tapping an unlocked node starts a lesson and routes to `/session/[id]`), `client/__tests__/home.test.tsx`.
  - Acceptance: `npm test -w client -- home` passes:
    - `renders unit titles and skill titles from /api/path`
    - `locked skill node is disabled`
    - `due skill shows due badge`
    - `tapping unlocked skill starts lesson and navigates to session`
    - `no hearts shows a 'hearts empty' message instead of starting a lesson`
    - `mistakes card hidden when count is 0`
    - `loading and error states render`

- [ ] **26. [frontend] Daily challenge screen**
  - Files: `client/app/daily.tsx`, `client/src/components/path/DailyChallengeCard.tsx` (link/status), `client/__tests__/daily.test.tsx`.
  - Acceptance: `npm test -w client -- daily` passes:
    - `not_started shows Start and 5 questions · ~3 min`
    - `in_progress shows Resume`
    - `completed shows done state with streak count`
    - `Start calls startDaily and navigates to session`

- [ ] **27. [frontend] Profile / stats screen**
  - Files: `client/app/(tabs)/profile.tsx`, `client/src/components/profile/` (`WeekXpBars` SVG bars, `SkillStatsList`, `DailyGoalPicker` 10/20/30/50 via PATCH /api/me), logout button, `client/__tests__/profile.test.tsx`.
  - Acceptance: `npm test -w client -- profile` passes:
    - `renders total XP, accuracy %, longest streak`
    - `WeekXpBars renders 7 bars`
    - `changing daily goal calls updateMe with dailyXpGoal`
    - `logout clears token and routes to login`

- [ ] **28. [frontend] Leaderboard + achievements screens**
  - Files: `client/app/(tabs)/leaderboard.tsx`, `client/app/(tabs)/achievements.tsx`, `client/src/components/social/` (`LeaderboardRow` with top-3 medal styling, highlighted `isMe` row; `AchievementBadge` locked/unlocked + progress bar), `client/__tests__/leaderboard.test.tsx`, `client/__tests__/achievements.test.tsx`.
  - Acceptance: `npm test -w client -- leaderboard achievements` passes:
    - `renders ranked entries and highlights me`
    - `shows my rank footer when I am outside the top 50`
    - `empty leaderboard shows empty state`
    - `achievements grid shows unlocked and locked badges`
    - `locked badge shows progress current/target`
  - Final frontend gate: root `npm test && npm run typecheck && npm run lint` exit 0, and `cd client && npx expo export --platform web` exits 0.

## Docs

- [ ] **29. [backend] Root README with run instructions**
  - Files: `README.md` (root only).
  - Contents: prerequisites (Node 22.13+, npm); `npm install` at root; `npm run dev -w server` (port 3000, binds 0.0.0.0) and `npm run seed -w server`; browser: `cd client && npx expo start --web`; phone: install Expo Go, put phone and host on the same LAN, `EXPO_PUBLIC_API_URL=http://<host-LAN-IP>:3000 npx expo start` then scan the QR (mention `--tunnel` is unavailable behind the egress firewall, and how to find the LAN IP on macOS/Linux/Windows); running `npm test` / `typecheck` / `lint`; `npx expo export --platform web`; project layout overview; content authoring notes (where units live, generator contract, no-LaTeX rule, run `npm test -w server -- content`).
  - Acceptance: `README.md` exists and contains the literal strings `EXPO_PUBLIC_API_URL`, `expo start --web`, `Expo Go`, `npm run dev -w server`, and `npm test` (checkable with `grep -c`). Every command in it matches a script that exists in the respective `package.json`.
