import type { APIRoute } from 'astro';
import { forbidden, handle, isBackOffice } from '../../../../../lib/pdv';

export const prerender = false;

/** POST /api/pdv/pedidos/:id/cancelar — só no mock: devolve as unidades. No modo `live` o cancelamento é no PDV (405). */
export const POST: APIRoute = (context) => {
	if (!isBackOffice(context)) return forbidden();
	return handle((pdv) => pdv.cancelarPedido(context.params.id ?? ''));
};
