#!/usr/bin/env node
/**
 * Aplica as migrações de `db/migrations` no banco de `DATABASE_URL`, em ordem e uma vez só.
 * Uso: pnpm db:migrate   (lê o .env se existir)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

try {
	process.loadEnvFile?.('.env');
} catch {
	/* sem .env: usa as variáveis do ambiente */
}

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('Defina DATABASE_URL.');
	process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const dir = new URL('../db/migrations/', import.meta.url).pathname;

try {
	await sql`CREATE TABLE IF NOT EXISTS schema_migrations (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())`;
	const feitas = new Set((await sql`SELECT nome FROM schema_migrations`).map((r) => r.nome));
	for (const nome of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
		if (feitas.has(nome)) continue;
		await sql.begin(async (tx) => {
			await tx.unsafe(readFileSync(join(dir, nome), 'utf8'));
			await tx`INSERT INTO schema_migrations (nome) VALUES (${nome})`;
		});
		console.log(`aplicada: ${nome}`);
	}
	console.log('banco em dia');
} finally {
	await sql.end();
}
