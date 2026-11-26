import type { APIRoute } from 'astro';
import { chamadaDoAgendador } from '../../../lib/cron';
import { enviarEmail } from '../../../lib/email';
import { json } from '../../../lib/pdv';
import { estadoDaSincronizacao, registrarAlerta } from '../../../lib/pdv/cloud';
import { chaveDoAlerta, mensagemDoAlerta, problemasDaSincronizacao } from '../../../lib/pdv/saude';
import { VERSAO_CONTRATO } from '../../../lib/pdv/sync';

export const prerender = false;

/**
 * GET /api/pdv-sync/saude — checa a sincronização com o PC da loja e avisa por e-mail quando os problemas
 * mudam (aparecem ou somem). Chamada pelo Vercel Schedules `saude-pdv` (vercel.json) de hora em hora no
 * horário da loja, com `Authorization: Bearer $CRON_SECRET`.
 */
export const GET: APIRoute = async ({ request }) => {
	if (!chamadaDoAgendador(request)) return json({ erro: { codigo: 'NAO_AUTORIZADO' } }, 401);
	try {
		const estado = await estadoDaSincronizacao();
		const problemas = problemasDaSincronizacao(estado);
		const chave = chaveDoAlerta(problemas);
		const avisar = chave !== estado.alertaChave;
		if (avisar) {
			// Falha no envio não grava a chave: a próxima checagem tenta de novo
			await enviarEmail(mensagemDoAlerta(problemas, estado, VERSAO_CONTRATO));
			await registrarAlerta(chave);
		}
		return json({ ok: problemas.length === 0, problemas, emailEnviado: avisar, versaoPdv: estado.versaoPdv, versaoSite: VERSAO_CONTRATO });
	} catch (error) {
		console.error('[pdv-saude] checagem falhou', error instanceof Error ? error.message : error);
		return json({ erro: { codigo: 'ERRO_INTERNO' } }, 500);
	}
};
