import { timingSafeEqual } from 'node:crypto';
import { getSecret } from 'astro:env/server';

/**
 * Rotas chamadas pelo Vercel Schedules (`vercel.json`) recebem `Authorization: Bearer $CRON_SECRET`.
 * São alvo `path` (e não função privada) porque o Astro junta todas as rotas numa função só.
 */
export function chamadaDoAgendador(request: Request) {
	const segredo = getSecret('CRON_SECRET') ?? '';
	if (segredo.length < 16) return false;
	const recebido = Buffer.from(request.headers.get('authorization') ?? '');
	const esperado = Buffer.from(`Bearer ${segredo}`);
	return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
