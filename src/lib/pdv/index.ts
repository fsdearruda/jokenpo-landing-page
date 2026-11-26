import { PEDIDOS_NO_SITE } from 'astro:env/server';
import { cloudPdv } from './cloud';
import { PdvError, type PdvClient } from './types';

export * from './types';

/**
 * O PDV da loja, pela ponte no Postgres (`DATABASE_URL`): o PC da loja sincroniza pelas rotas
 * `/api/pdv-sync/*` e a vitrine e as rotas `/api/pdv/*` leem daqui. Sem banco, a vitrine fica vazia
 * (com o WhatsApp) e as rotas respondem erro.
 */
export const getPdv = (): PdvClient => cloudPdv;

/**
 * Pedido criado no site (a loja confirma o estoque). `PEDIDOS_NO_SITE=false` manda o pedido só pelo
 * WhatsApp sem mexer no catálogo. A loja sem sincronizar há horas também desliga sozinha (`lojaOffline`).
 */
export const pedidosNoSite = PEDIDOS_NO_SITE;

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
