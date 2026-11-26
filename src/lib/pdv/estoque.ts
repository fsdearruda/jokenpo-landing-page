import type { ComponenteKit, PromocaoFoto } from './sync';
import type { StatusPedido } from './types';

/**
 * Regras puras do estoque mostrado no site (sem banco, testadas em estoque.test.ts).
 * `cloud.ts` busca os dados no Postgres e usa estas funções.
 */

/** Selo só enquanto a promoção vale. Se o PDV ficar offline, o selo some no fim mesmo sem um novo envio. */
export const promocaoVigente = (p: PromocaoFoto | null | undefined, agora = Date.now()) =>
	p && Date.parse(p.terminaEm) > agora ? p : null;

/**
 * Unidades pedidas no site que a última foto do PDV ainda não inclui, por produto.
 * Kit conta nos componentes (é deles que o PDV separa o estoque).
 */
export function calcularDemanda(
	pedidos: { itens: { produtoId: string; quantidade: number }[] }[],
	composicao: Map<string, ComponenteKit[]>,
) {
	const demanda = new Map<string, number>();
	for (const { itens } of pedidos) somarItens(demanda, itens, composicao);
	return demanda;
}

/** Soma itens (de um pedido existente ou do que está sendo criado) na demanda. */
export function somarItens(
	demanda: Map<string, number>,
	itens: { produtoId: string; quantidade: number }[],
	composicao: Map<string, ComponenteKit[]>,
) {
	const somar = (id: string, q: number) => demanda.set(id, (demanda.get(id) ?? 0) + q);
	for (const item of itens) {
		const comps = composicao.get(item.produtoId);
		if (comps?.length) for (const c of comps) somar(c.produtoId, c.quantidade * item.quantidade);
		else somar(item.produtoId, item.quantidade);
	}
}

/** Disponível no site: o do PDV menos a demanda pendente; kit pelo componente que acaba primeiro. */
export function disponivelNoSite(
	p: { produto_id: string; disponivel: number; componentes: ComponenteKit[] | null },
	demanda: Map<string, number>,
) {
	if (p.componentes?.length) {
		return Math.max(0, Math.min(...p.componentes.map((c) => Math.floor((c.disponivel - (demanda.get(c.produtoId) ?? 0)) / c.quantidade))));
	}
	return Math.max(0, p.disponivel - (demanda.get(p.produto_id) ?? 0));
}

/**
 * Sem estoque aceito por esse tempo, o site para de criar pedidos e manda pelo WhatsApp:
 * um pedido feito agora ficaria horas sem confirmação (até expirar em 72 h). Cobre o PC desligado à noite.
 */
export const LOJA_OFFLINE_HORAS = 6;

/**
 * O PC manda a foto completa a cada 10 min. Se ele segue falando com o site (buscando pedidos) mas nenhum
 * envio de estoque é aceito há esse tempo, o estoque da vitrine está velho: os pedidos também pausam.
 */
export const ESTOQUE_PARADO_MINUTOS = 30;

export interface ContatoLoja {
	/** Última vez que o PC da loja falou com o site (qualquer rota de sincronização). */
	vistaEm: Date | string | null;
	/** Último envio de estoque aceito. */
	estoqueEm: Date | string | null;
}

const ms = (d: Date | string) => new Date(d).getTime();

export const lojaOffline = ({ vistaEm, estoqueEm }: ContatoLoja, agora = Date.now()) => {
	if (!estoqueEm) return true;
	if (agora - ms(estoqueEm) > LOJA_OFFLINE_HORAS * 3_600_000) return true;
	return vistaEm != null && ms(vistaEm) - ms(estoqueEm) > ESTOQUE_PARADO_MINUTOS * 60_000;
};

/** Ordem do pedido no site. RECUSADO, CANCELADO, EXPIRADO e ENTREGUE encerram: depois deles nada muda. */
const ORDEM_STATUS: Record<StatusPedido, number> = {
	AGUARDANDO_CONFIRMACAO: 0,
	PAGAMENTO_PENDENTE: 1,
	PAGO: 2,
	ENTREGUE: 3,
	RECUSADO: 3,
	CANCELADO: 3,
	EXPIRADO: 3,
};
const encerrado = (s: StatusPedido) => ORDEM_STATUS[s] === 3;

/**
 * Status vindo do PDV só anda para frente: um envio atrasado ou repetido não volta PAGO para
 * PAGAMENTO_PENDENTE, nem reabre pedido encerrado. O mesmo status passa (atualiza prazo e número).
 */
export const podeMudarStatus = (atual: StatusPedido, novo: StatusPedido) =>
	atual === novo || (!encerrado(atual) && ORDEM_STATUS[novo] >= ORDEM_STATUS[atual]);

/** Pedido esperando a loja além do prazo conta como expirado, mesmo antes da faxina gravar. */
export const expirouSemConfirmacao = (status: StatusPedido, criadoEm: Date, prazoHoras: number, agora = Date.now()) =>
	status === 'AGUARDANDO_CONFIRMACAO' && agora - criadoEm.getTime() > prazoHoras * 3_600_000;
