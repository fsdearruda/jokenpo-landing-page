import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Testes que usam o banco (cloud.ts, limite.ts, rotas /api/*) contra um Postgres em memória (PGlite).
// `pnpm test:integracao`; roda no CI. Um arquivo por vez: o banco é um só.
export default defineConfig({
	resolve: { alias: { 'astro:env/server': fileURLToPath(new URL('./test/astro-env.ts', import.meta.url)) } },
	test: {
		include: ['src/**/*.integracao.test.ts'],
		environment: 'node',
		globalSetup: ['test/pglite-setup.ts'],
		setupFiles: ['test/integracao-env.ts'],
		fileParallelism: false,
		testTimeout: 20_000,
		hookTimeout: 60_000,
	},
});
