import { getSecret } from 'astro:env/server';
import { json } from './index';
import { assinaturaValida } from './sync';

/** Maior corpo aceito do PDV (foto completa com alguns milhares de produtos). */
const MAX_CORPO = 4 * 1024 * 1024;

/**
 * Confere a assinatura HMAC do PC da loja e devolve o corpo já lido.
 * `Response` = recusa pronta para devolver.
 */
export async function lerRequisicaoDoPdv(request: Request): Promise<{ corpo: string } | Response> {
	const segredo = getSecret('PDV_SYNC_TOKEN') ?? '';
	if (segredo.length < 32) return json({ erro: { codigo: 'SYNC_DESATIVADO', mensagem: 'Sincronização não configurada.' } }, 503);
	if (Number(request.headers.get('content-length') ?? 0) > MAX_CORPO) return json({ erro: { codigo: 'GRANDE_DEMAIS' } }, 413);
	const corpo = request.method === 'GET' ? '' : await request.text();
	if (corpo.length > MAX_CORPO) return json({ erro: { codigo: 'GRANDE_DEMAIS' } }, 413);
	const url = new URL(request.url);
	const ok = assinaturaValida(
		segredo,
		request.headers.get('x-pdv-timestamp') ?? '',
		request.method,
		url.pathname + url.search,
		corpo,
		request.headers.get('x-pdv-assinatura') ?? '',
	);
	if (!ok) return json({ erro: { codigo: 'NAO_AUTORIZADO', mensagem: 'Assinatura inválida.' } }, 401);
	return { corpo };
}

export const parse = (corpo: string): unknown => {
	try {
		return JSON.parse(corpo);
	} catch {
		return null;
	}
};

export const syncError = (error: unknown) => {
	console.error('[pdv-sync] erro', error instanceof Error ? error.message : error);
	return json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Falha ao gravar a sincronização.' } }, 500);
};
