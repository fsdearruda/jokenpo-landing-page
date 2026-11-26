import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { TestProject } from 'vitest/node';

/**
 * Postgres de verdade (PGlite: o Postgres compilado para WebAssembly) num processo só, sem Docker nem banco
 * na nuvem. Sobe um servidor de socket numa porta livre, aplica as migrações com o script de produção
 * (`scripts/db-migrate.mjs`) e passa a URL para os testes.
 */
export default async function setup(project: TestProject) {
	const db = await PGlite.create();
	const porta = 54_000 + Math.floor(Math.random() * 1000);
	const server = new PGLiteSocketServer({ db, port: porta, host: '127.0.0.1', maxConnections: 10 });
	await server.start();
	const url = `postgres://postgres:postgres@127.0.0.1:${porta}/postgres`;
	// Assíncrono: o servidor do PGlite roda neste mesmo processo e precisa do event loop livre para responder
	const { stdout } = await promisify(execFile)('node', ['scripts/db-migrate.mjs'], {
		env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: '', VERCEL_ENV: '' },
	});
	process.stdout.write(stdout);
	project.provide('databaseUrl', url);
	return async () => {
		await server.stop();
		await db.close();
	};
}

declare module 'vitest' {
	export interface ProvidedContext {
		databaseUrl: string;
	}
}
