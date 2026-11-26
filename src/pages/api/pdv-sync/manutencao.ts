import type { APIRoute } from 'astro';
import { chamadaDoAgendador } from '../../../lib/cron';
import { json } from '../../../lib/pdv';
import { manutencao } from '../../../lib/pdv/cloud';
import { apagarFotosOrfas } from '../../../lib/pdv/fotos';

export const prerender = false;

/**
 * GET /api/pdv-sync/manutencao — faxina diária (Vercel Schedules `manutencao-pdv`): grava pedidos expirados,
 * mascara contatos antigos (LGPD), limpa o limite por IP e apaga fotos órfãs do Blob.
 * Idempotente: rodar duas vezes não muda nada.
 */
export const GET: APIRoute = async ({ request }) => {
	if (!chamadaDoAgendador(request)) return json({ erro: { codigo: 'NAO_AUTORIZADO' } }, 401);
	try {
		const { fotosEmUso, ...banco } = await manutencao();
		// Banco primeiro: se o Blob falhar, a parte do banco já foi feita e a próxima execução tenta de novo
		const fotosApagadas = await apagarFotosOrfas(fotosEmUso).catch((error) => {
			console.error('[pdv-manutencao] faxina do Blob falhou', error instanceof Error ? error.message : error);
			return null;
		});
		console.log('[pdv-manutencao]', JSON.stringify({ ...banco, fotosApagadas }));
		return json({ ok: true, ...banco, fotosApagadas });
	} catch (error) {
		console.error('[pdv-manutencao] falhou', error instanceof Error ? error.message : error);
		return json({ erro: { codigo: 'ERRO_INTERNO' } }, 500);
	}
};
