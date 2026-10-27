# Loopy

A Duolingo-style app for learning control theory. npm workspaces monorepo:

- `server/` is Fastify plus `node:sqlite` (TypeScript, run with `tsx`)
- `client/` is Expo Router, running on web, iOS and Android

## Prerequisites

- Node.js 22.13 or later (`node:sqlite` needs it; enforced by `engines` in `package.json`)
- npm (ships with Node)
- To run on a phone: the **Expo Go** app (iOS App Store / Google Play)

## Install

```sh
npm install        # at the repo root; installs both workspaces
```

## Run the server

```sh
npm run dev -w server     # tsx watch; http://0.0.0.0:3000, health check at GET /health
npm run seed -w server    # optional demo data
npm run start -w server   # same as dev, without file watching
```

- Port comes from `PORT` (default `3000`). The server binds `0.0.0.0`, so other devices on your LAN can reach it.
- Database file comes from `DB_PATH` (default `server/data/loopy.db`, created automatically). The seed script uses the same variable and default.
- Seeding creates the demo login **`demo` / `demopass1`** with some progress, plus 5 fake leaderboard users (`ada_loop`, `bode_plotter`, `nyquist_nina`, `pid_pete`, `root_locus`). Users that already exist are skipped, so re-running it is safe.

Check that it is up: `curl http://localhost:3000/health` should print `{"ok":true}`.

## Run the client

The client reads the API base URL from `EXPO_PUBLIC_API_URL` (default `http://localhost:3000`). Metro inlines it at build time, so restart Expo after you change it.

### In a browser

```sh
cd client && npx expo start --web     # or: npm run web -w client
```

### On a phone (Expo Go)

1. Install Expo Go on the phone.
2. Put the phone and the host machine on the **same LAN** (same Wi-Fi network).
3. Find the host's LAN IP:
   - macOS: `ipconfig getifaddr en0` (or `en1`)
   - Linux: `hostname -I` or `ip -4 addr`
   - Windows: `ipconfig` and look for "IPv4 Address"
4. Start the server (above), then:

   ```sh
   cd client
   EXPO_PUBLIC_API_URL=http://<host-LAN-IP>:3000 npx expo start
   ```

   (On Windows PowerShell, use `$env:EXPO_PUBLIC_API_URL="http://<host-LAN-IP>:3000"; npx expo start`.)
5. Scan the QR code with Expo Go (Android) or the Camera app (iOS).

`--tunnel` mode does not work inside the dev container because the egress firewall blocks it, so you need LAN mode. If you run inside the dev container, forward ports 3000 and 8081 to the host.

## Tests, typecheck, lint

From the repo root (each runs across both workspaces):

```sh
npm test
npm run typecheck
npm run lint
```

To run one workspace only: `npm test -w server` (vitest) or `npm test -w client` (jest with `jest-expo`).

## Web export

```sh
cd client && npx expo export --platform web    # static build in client/dist
```

## Project layout

```
package.json             workspaces + root test/typecheck/lint scripts
server/
  src/index.ts           entry point (PORT, DB_PATH, listen on 0.0.0.0)
  src/app.ts             buildApp(): Fastify instance, plugins, routes
  src/routes/            HTTP routes under /api, plus /health
  src/auth/  src/db/     auth and SQLite schema/access
  src/engine/            adaptive engine (ability estimate, question selection, spaced review)
  src/services/          sessions, hearts, XP, streaks, daily, leaderboard, achievements
  src/content/           curriculum, question types, validator, content units
  src/scripts/seed-demo.ts
  test/                  vitest suites
client/
  app/                   Expo Router screens
  src/api/  src/auth/    API client and auth state
  src/components/  src/hooks/  src/theme/
  src/config.ts          EXPO_PUBLIC_API_URL
  __tests__/             jest tests
```

## Authoring content

- Units live in `server/src/content/units/uNN-<name>.ts` (`u01-laplace.ts` through `u11-state-space.ts`). Each one default-exports `defineUnit({ unitId, items, generators })`. Unit and skill ids come from `server/src/content/curriculum.ts`.
- Register a new unit in `server/src/content/units/index.ts` by adding one import and one array entry.
- `server/src/content/authoring.ts` has the full guide in its header comment. Read it first.
- **Generator contract:** `generate(rng, d)` must be a pure function of `rng` and `d`. Use only the `rng.ts` helpers (`int`, `pick`, `shuffle`, `chance`), never `Math.random` or `Date`, so a stored seed reproduces the question. It must return the generator's own `skillId` with `difficulty: d`, and only for the difficulties it declares. Use nice numbers, formatted with `nice()`. Every output must pass `validateQuestion` and grade its own answer as correct.
- **No LaTeX.** Use Unicode plain text only (s², ζ, ωn, ∞, √, →, ≤). The validator rejects `\`, `$`, `^{` and `_{`. Prompts and explanations must be at most 300 characters.
- Check your work with:

  ```sh
  npm test -w server -- content
  ```
