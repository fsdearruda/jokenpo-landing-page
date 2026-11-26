import { defineConfig } from 'vitest/config';

// Só regras puras (sem `astro:*`): contrato com o PDV e cálculo de estoque.
export default defineConfig({
	test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
