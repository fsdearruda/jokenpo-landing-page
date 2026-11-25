import type { APIRoute } from 'astro';
import { handle, json, readJson, type CriarPedidoInput } from '../../../../lib/pdv';

export const prerender = false;

/**
 * POST /api/pdv/pedidos — cria uma reserva para retirada na loja.
 * Corpo: `{ itens: [{ produtoId, quantidade }], nomeContato, telefoneContato }`.
 */
export const POST: APIRoute = async ({ request }) => {
	if (!request.headers.get('content-type')?.includes('application/json')) {
		return json({ erro: { codigo: 'FORMATO_INVALIDO', mensagem: 'Envie JSON.' } }, 415);
	}
	const body = (await readJson(request)) as Partial<CriarPedidoInput> | null;
	if (!body || typeof body !== 'object') {
		return json({ erro: { codigo: 'FORMATO_INVALIDO', mensagem: 'JSON inválido.' } }, 400);
	}
	return handle((pdv) =>
		pdv.criarPedido({
			itens: Array.isArray(body.itens) ? body.itens : [],
			nomeContato: String(body.nomeContato ?? ''),
			telefoneContato: String(body.telefoneContato ?? ''),
		}),
	);
};
