import type { APIRoute } from 'astro';
import { confirmarEventos } from '../../../../lib/pdv/cloud';
import { lerResultados } from '../../../../lib/pdv/sync';
import { lerRequisicaoDoPdv, parse, syncError, respostaSync } from '../../../../lib/pdv/sync-auth';

export const prerender = false;

/** POST /api/pdv-sync/eventos/ack — o PC da loja informa o que aplicou ou recusou. */
export const POST: APIRoute = async ({ request }) => {
	const req = await lerRequisicaoDoPdv(request);
	if (req instanceof Response) return req;
	const resultados = lerResultados(parse(req.corpo));
	if (!resultados) return respostaSync({ erro: { codigo: 'FORMATO_INVALIDO', mensagem: 'Confirmação inválida.' } }, 400);
	try {
		await confirmarEventos(resultados, req.versao);
		return respostaSync({ ok: true });
	} catch (error) {
		return syncError(error);
	}
};
