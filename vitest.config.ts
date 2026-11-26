import { defineConfig } from 'vitest/config';

// Só regras puras (sem `astro:*` nem banco). Os testes com banco ficam em vitest.integracao.config.ts.
export default defineConfig({
	test: { include: ['src/**/*.test.ts'], exclude: ['src/**/*.integracao.test.ts'], environment: 'node' },
});
