import { builtinModules } from 'node:module';
import { defineConfig } from 'vitest/config';

// node:sqlite is a "node:"-only builtin (no bare "sqlite" alias), which some
// Vite versions fail to recognise as external. Externalize every node: builtin
// explicitly and run tests in forks so the real Node runtime resolves them.
const nodeBuiltins = [...builtinModules, 'sqlite'].map((m) => (m.startsWith('node:') ? m : `node:${m}`));

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    server: {
      deps: {
        external: [...nodeBuiltins, /^node:/],
      },
    },
  },
  ssr: {
    external: nodeBuiltins,
  },
});
