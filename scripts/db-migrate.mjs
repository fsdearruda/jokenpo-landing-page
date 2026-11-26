#!/usr/bin/env node
/**
 * Aplica as migrações de `db/migrations` no banco de `DATABASE_URL`, em ordem e uma vez só.
 * Uso: pnpm db:migrate   (lê o .env se existir)
 *
 * Também roda no build da Vercel (`vercel-build`, com `--se-houver`: sem banco configurado, não faz nada).
 * Migrações só acrescentam (IF NOT EXISTS), então o deploy anterior continua funcionando no banco novo.
 * Dois builds ao mesmo tempo no mesmo banco (dois previews) esperam um pelo outro (advisory lock).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

try {
	process.loadEnvFile?.('.env');
} catch {
	/* sem .env: usa as variáveis do ambiente */
}

// DDL e lock pela conexão direta quando houver (a integração do Neon cria DATABASE_URL_UNPOOLED)
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
	if (process.argv.includes('--se-houver')) {
		console.log('db-migrate: sem DATABASE_URL, nada a fazer.');
		process.exit(0);
	}
	console.error('Defina DATABASE_URL.');
	process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const dir = new URL('../db/migrations/', import.meta.url).pathname;

try {
	await sql`CREATE TABLE IF NOT EXISTS schema_migrations (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())`;
	for (const nome of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
		const aplicada = await sql.begin(async (tx) => {
			await tx`SELECT pg_advisory_xact_lock(hashtext('jokenpo:db-migrate'))`;
			const [feita] = await tx`SELECT 1 FROM schema_migrations WHERE nome = ${nome}`;
			if (feita) return false;
			await tx.unsafe(readFileSync(join(dir, nome), 'utf8'));
			await tx`INSERT INTO schema_migrations (nome) VALUES (${nome})`;
			return true;
		});
		if (aplicada) console.log(`aplicada: ${nome}`);
	}
	console.log('banco em dia');
} finally {
	await sql.end();
}
