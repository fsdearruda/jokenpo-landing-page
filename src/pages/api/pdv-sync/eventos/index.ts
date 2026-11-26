import type { APIRoute } from 'astro';
import { listarEventos } from '../../../../lib/pdv/cloud';
import { lerRequisicaoDoPdv, syncError, respostaSync } from '../../../../lib/pdv/sync-auth';

export const prerender = false;

/** GET /api/pdv-sync/eventos?depois=<id>&limite=<n> — pedidos do site para o PC da loja aplicar. */
export const GET: APIRoute = async ({ request, url }) => {
	const req = await lerRequisicaoDoPdv(request);
	if (req instanceof Response) return req;
	const depois = Math.max(0, Math.trunc(Number(url.searchParams.get('depois') ?? 0)) || 0);
	const limite = Math.min(200, Math.max(1, Math.trunc(Number(url.searchParams.get('limite') ?? 50)) || 50));
	try {
		return respostaSync({ eventos: await listarEventos(depois, limite, req.versao) });
	} catch (error) {
		return syncError(error);
	}
};
