import { timingSafeEqual } from 'node:crypto';
import type { APIContext } from 'astro';
import { getSecret } from 'astro:env/server';
import { cloudPdv } from './cloud';
import { mockPdv } from './mock';
import { PdvError, type PdvClient } from './types';

export * from './types';

/**
 * `live`: a vitrine e as rotas `/api/pdv/*` usam o PDV real, pela ponte no Postgres
 *   (`DATABASE_URL`). O PC da loja sincroniza pelas rotas `/api/pdv-sync/*`.
 * `mock`: PDV simulado em memória (padrão no `astro dev`).
 * `off`: rotas desligadas (503) e a vitrine usa o estoque extraído no build, com o
 *   pedido só pelo WhatsApp (padrão no build sem configuração).
 */
export type PdvMode = 'live' | 'mock' | 'off';

export const pdvMode: PdvMode =
	(import.meta.env.PUBLIC_PDV_MODE as PdvMode | undefined) || (import.meta.env.DEV ? 'mock' : 'off');

export const getPdv = (): PdvClient | null => (pdvMode === 'live' ? cloudPdv : pdvMode === 'mock' ? mockPdv : null);

export const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
			'X-Robots-Tag': 'noindex',
		},
	});

/** Executa a operação e traduz `PdvError` em JSON com o status certo. */
export const handle = async (operation: (pdv: PdvClient) => Promise<unknown>) => {
	const pdv = getPdv();
	if (!pdv) return json({ erro: { codigo: 'PDV_DESATIVADO', mensagem: 'Integração com o PDV desativada.' } }, 503);
	try {
		return json(await operation(pdv));
	} catch (error) {
		if (error instanceof PdvError) {
			return json({ erro: { codigo: error.code, mensagem: error.message, detalhes: error.details } }, error.status);
		}
		console.error('[pdv] erro inesperado', error instanceof Error ? error.message : error);
		return json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não deu para falar com o PDV agora.' } }, 500);
	}
};

/**
 * Rotas de balcão do mock (confirmar e cancelar) simulam o que a loja faria no PDV.
 * Exigem `Authorization: Bearer <PDV_MOCK_ADMIN_TOKEN>`; sem token configurado, só
 * funcionam no `astro dev`. No modo `live` isso é feito no PDV e as rotas respondem 405.
 */
export const isBackOffice = ({ request }: APIContext) => {
	const token = getSecret('PDV_MOCK_ADMIN_TOKEN');
	if (!token) return import.meta.env.DEV;
	const esperado = Buffer.from(`Bearer ${token}`);
	const recebido = Buffer.from(request.headers.get('authorization') ?? '');
	return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
};

export const forbidden = () => json({ erro: { codigo: 'NAO_AUTORIZADO', mensagem: 'Rota restrita ao balcão.' } }, 401);

/** Lê o corpo JSON com limite de tamanho, devolvendo `null` se for inválido. */
export const readJson = async (request: Request, maxBytes = 4096): Promise<unknown> => {
	const text = await request.text();
	if (text.length > maxBytes) return null;
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
};
