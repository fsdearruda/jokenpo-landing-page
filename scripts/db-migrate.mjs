#!/usr/bin/env node
/**
 * Aplica as migrações de `db/migrations` no banco de `DATABASE_URL`, em ordem e uma vez só.
 * Uso: pnpm db:migrate   (lê o .env se existir)
 *
 * Também roda no build da Vercel (`vercel-build`, com `--se-houver`: sem banco configurado, não faz nada).
 * Migrações só acrescentam (IF NOT EXISTS), então o deploy anterior continua funcionando no banco novo.
 * Dois builds ao mesmo tempo no mesmo banco (dois previews) esperam um pelo outro (advisory lock).
 * Cada migração aplicada guarda o hash do arquivo: editar uma migração já aplicada falha o build
 * (crie uma nova em vez disso). Em produção, faltar `DATABASE_URL` ou `PDV_SYNC_TOKEN` também falha.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

try {
	process.loadEnvFile?.('.env');
} catch {
	/* sem .env: usa as variáveis do ambiente */
}

// Deploy de produção sem banco ou sem token publicaria uma loja vazia: melhor o build falhar
if (process.env.VERCEL_ENV === 'production') {
	const faltando = ['DATABASE_URL', 'PDV_SYNC_TOKEN'].filter((nome) => !process.env[nome]);
	if (faltando.length) {
		console.error(`db-migrate: produção sem ${faltando.join(' e ')}. Configure na Vercel antes do deploy.`);
		process.exit(1);
	}
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
	await sql`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text`;
	for (const nome of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
		const texto = readFileSync(join(dir, nome), 'utf8');
		// Fim de linha normalizado: o mesmo arquivo no Windows e no Linux dá o mesmo hash
		const checksum = createHash('sha256').update(texto.replace(/\r\n/g, '\n')).digest('hex');
		const aplicada = await sql.begin(async (tx) => {
			await tx`SELECT pg_advisory_xact_lock(hashtext('jokenpo:db-migrate'))`;
			const [feita] = await tx`SELECT checksum FROM schema_migrations WHERE nome = ${nome}`;
			if (feita) {
				// Migrações de antes do hash ganham o hash atual na primeira passada
				if (!feita.checksum) await tx`UPDATE schema_migrations SET checksum = ${checksum} WHERE nome = ${nome}`;
				else if (feita.checksum !== checksum) {
					throw new Error(`${nome} mudou depois de aplicada. Desfaça a edição e crie uma migração nova.`);
				}
				return false;
			}
			await tx.unsafe(texto);
			await tx`INSERT INTO schema_migrations (nome, checksum) VALUES (${nome}, ${checksum})`;
			return true;
		});
		if (aplicada) console.log(`aplicada: ${nome}`);
	}
	console.log('banco em dia');
} finally {
	await sql.end();
}
