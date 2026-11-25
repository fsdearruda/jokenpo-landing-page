import type { APIRoute } from 'astro';
import { receberEstoque } from '../../../lib/pdv/cloud';
import { json } from '../../../lib/pdv';
import { lerEnvioEstoque } from '../../../lib/pdv/sync';
import { lerRequisicaoDoPdv, parse, syncError } from '../../../lib/pdv/sync-auth';

export const prerender = false;

/** POST /api/pdv-sync/estoque — o PC da loja envia o estoque disponível e o status dos pedidos. */
export const POST: APIRoute = async ({ request }) => {
	const req = await lerRequisicaoDoPdv(request);
	if (req instanceof Response) return req;
	const envio = lerEnvioEstoque(parse(req.corpo));
	if (!envio) return json({ erro: { codigo: 'FORMATO_INVALIDO', mensagem: 'Envio de estoque inválido.' } }, 400);
	try {
		return json(await receberEstoque(envio));
	} catch (error) {
		return syncError(error);
	}
};
