import type { ComponenteKit, PromocaoFoto } from './sync';

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
