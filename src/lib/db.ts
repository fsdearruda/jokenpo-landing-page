import { getSecret } from 'astro:env/server';
import postgres from 'postgres';

/**
 * Conexão com o Postgres da ponte site ↔ PDV (Neon pela Vercel em produção).
 * Uma conexão por instância da função: o pooler do Neon cuida do resto.
 * `prepare: false` mantém compatível com o pooler em modo transação.
 */
const globalStore = globalThis as typeof globalThis & { __jokenpoSql?: postgres.Sql };


export const sql = (): postgres.Sql => {
	const url = getSecret('DATABASE_URL');
	if (!url) throw new Error('DATABASE_URL não definida.');
	return (globalStore.__jokenpoSql ??= postgres(url, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} }));
};
