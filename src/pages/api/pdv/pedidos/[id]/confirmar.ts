import type { APIRoute } from 'astro';
import { forbidden, handle, isBackOffice, readJson, type MetodoPagamento } from '../../../../../lib/pdv';

export const prerender = false;

const metodos: MetodoPagamento[] = ['PIX', 'DEBITO', 'CREDITO', 'DINHEIRO'];

/**
 * POST /api/pdv/pedidos/:id/confirmar — só no mock: simula a loja registrando o pagamento.
 * No modo `live` o pagamento é registrado no PDV (aba Pedidos) e a rota responde 405.
 */
export const POST: APIRoute = async (context) => {
	if (!isBackOffice(context)) return forbidden();
	const body = (await readJson(context.request)) as { metodo?: MetodoPagamento } | null;
	const metodo = body?.metodo && metodos.includes(body.metodo) ? body.metodo : 'DINHEIRO';
	return handle((pdv) => pdv.confirmarPagamento(context.params.id ?? '', metodo));
};
