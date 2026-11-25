import type { APIRoute } from 'astro';
import { forbidden, handle, isBackOffice, readJson, type MetodoPagamento } from '../../../../../lib/pdv';

export const prerender = false;

const metodos: MetodoPagamento[] = ['PIX', 'DEBITO', 'CREDITO', 'DINHEIRO'];

/**
 * POST /api/pdv/pedidos/:id/confirmar — simula o pagamento aprovado
 * (no balcão ou, no futuro, pelo webhook do Mercado Pago) e baixa o estoque.
 */
export const POST: APIRoute = async (context) => {
	if (!isBackOffice(context)) return forbidden();
	const body = (await readJson(context.request)) as { metodo?: MetodoPagamento } | null;
	const metodo = body?.metodo && metodos.includes(body.metodo) ? body.metodo : 'DINHEIRO';
	return handle((pdv) => pdv.confirmarPagamento(context.params.id ?? '', metodo));
};
