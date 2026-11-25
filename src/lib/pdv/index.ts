import type { APIContext } from 'astro';
import { mockPdv } from './mock';
import { PdvError, type PdvClient } from './types';

export * from './types';

/**
 * `mock`: as rotas `/api/pdv/*` respondem com o PDV simulado em memória e a
 *   vitrine busca o estoque ao vivo nele.
 * `off`: rotas desligadas (503) e a vitrine usa o estoque extraído no build.
 *
 * Nos dois casos o pedido do cliente sai pelo WhatsApp da loja. Padrão:
 * `mock` no `astro dev` e `off` no build de produção, porque o estado do
 * mock não é compartilhado entre instâncias da Vercel.
 */
export type PdvMode = 'mock' | 'off';

export const pdvMode: PdvMode =
	(import.meta.env.PUBLIC_PDV_MODE as PdvMode | undefined) ?? (import.meta.env.DEV ? 'mock' : 'off');

export const getPdv = (): PdvClient | null => (pdvMode === 'mock' ? mockPdv : null);

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
 * Rotas de balcão (confirmar e cancelar) simulam o que o PDV ou o webhook de
 * pagamento fariam. Exigem `Authorization: Bearer <PDV_MOCK_ADMIN_TOKEN>`;
 * sem token configurado, só funcionam no `astro dev`.
 */
export const isBackOffice = ({ request }: APIContext) => {
	const token = import.meta.env.PDV_MOCK_ADMIN_TOKEN;
	if (!token) return import.meta.env.DEV;
	return request.headers.get('authorization') === `Bearer ${token}`;
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
