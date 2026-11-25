import type { APIRoute } from 'astro';
import { getPdv, handle, json, readJson, type CriarPedidoInput } from '../../../../lib/pdv';
import { dentroDoLimite, hashIp } from '../../../../lib/pdv/limite';

export const prerender = false;

/**
 * POST /api/pdv/pedidos — cria um pedido para retirada na loja. Nasce aguardando a
 * confirmação do estoque pelo PC da loja; depois o pagamento é combinado no WhatsApp.
 * Corpo: `{ itens: [{ produtoId, quantidade }], nomeContato, telefoneContato }`.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
	let ip: string | undefined;
	try {
		ip = clientAddress;
	} catch {
		/* adaptador sem IP do cliente */
	}
	if (getPdv()) {
		const permitido = await dentroDoLimite(ip).catch(() => true); // limite fora do ar não bloqueia venda
		if (!permitido) {
			return json({ erro: { codigo: 'MUITAS_TENTATIVAS', mensagem: 'Muitos pedidos seguidos. Espera uns minutos ou chama a gente no WhatsApp.' } }, 429);
		}
	}
	if (!request.headers.get('content-type')?.includes('application/json')) {
		return json({ erro: { codigo: 'FORMATO_INVALIDO', mensagem: 'Envie JSON.' } }, 415);
	}
	const body = (await readJson(request)) as Partial<CriarPedidoInput> | null;
	if (!body || typeof body !== 'object') {
		return json({ erro: { codigo: 'FORMATO_INVALIDO', mensagem: 'JSON inválido.' } }, 400);
	}
	return handle((pdv) =>
		pdv.criarPedido(
			{
				itens: Array.isArray(body.itens) ? body.itens : [],
				nomeContato: String(body.nomeContato ?? ''),
				telefoneContato: String(body.telefoneContato ?? ''),
			},
			{ ipHash: ip ? hashIp(ip) : undefined },
		),
	);
};
