/**
 * Contrato da integração com o PDV (ponto de venda).
 *
 * Ciclo de um pedido do site:
 * 1. `AGUARDANDO_CONFIRMACAO`: criado aqui; a loja ainda não conferiu o estoque
 *    (o PC da loja pode estar desligado ou sem internet). As unidades ficam seguras no site.
 * 2. O PC da loja recebe o pedido e separa o estoque: `PAGAMENTO_PENDENTE`, com 48 h para
 *    pagar pelo WhatsApp. Sem estoque: `RECUSADO`.
 * 3. A loja registra o pagamento no PDV: `PAGO`. Na retirada: `ENTREGUE`.
 *    Sem pagamento em 48 h: `EXPIRADO`. A loja pode cancelar: `CANCELADO`.
 */

export type StatusPedido =
	| 'AGUARDANDO_CONFIRMACAO'
	| 'PAGAMENTO_PENDENTE'
	| 'PAGO'
	| 'ENTREGUE'
	| 'RECUSADO'
	| 'CANCELADO'
	| 'EXPIRADO';
export type MetodoPagamento = 'PIX' | 'DEBITO' | 'CREDITO' | 'DINHEIRO';

export interface EstoqueItem {
	produtoId: string;
	disponivel: number;
	precoCentavos: number;
}

/** Produto do catálogo vindo do PDV (marcado em Cadastros → Site). */
export interface ProdutoCatalogo extends EstoqueItem {
	sku: string | null;
	nome: string;
	categoria: string | null;
	grupo: string | null;
}

export interface ItemPedidoInput {
	produtoId: string;
	quantidade: number;
}

export interface CriarPedidoInput {
	itens: ItemPedidoInput[];
	nomeContato: string;
	telefoneContato: string;
}

export interface ItemPedido {
	produtoId: string;
	descricao: string;
	quantidade: number;
	precoUnitarioCentavos: number;
	totalCentavos: number;
}

/** Visão pública de um pedido. Telefone e nome nunca voltam completos. */
export interface PedidoPublico {
	id: string;
	numero: number;
	status: StatusPedido;
	itens: ItemPedido[];
	totalCentavos: number;
	nomeContato: string;
	telefoneContato: string;
	/** Prazo para pagar (só depois que a loja confirma o estoque). */
	validoAte: string | null;
	motivo: string | null;
	criadoEm: string;
}

export type PdvErrorCode =
	| 'ITEM_INVALIDO'
	| 'ESTOQUE_INSUFICIENTE'
	| 'CONTATO_INVALIDO'
	| 'PEDIDO_NAO_ENCONTRADO'
	| 'STATUS_INVALIDO'
	| 'OPERACAO_NO_PDV';

export class PdvError extends Error {
	constructor(
		public code: PdvErrorCode,
		message: string,
		public status = 400,
		public details?: unknown,
	) {
		super(message);
	}
}

/** Operações que o site precisa do PDV. O mock e a ponte com o PDV real implementam a mesma interface. */
export interface PdvClient {
	listarEstoque(): Promise<EstoqueItem[]>;
	/** `null` quando a fonte não tem catálogo próprio (o mock usa o `products.json`). */
	listarCatalogo(): Promise<ProdutoCatalogo[] | null>;
	criarPedido(input: CriarPedidoInput): Promise<PedidoPublico>;
	buscarPedido(id: string): Promise<PedidoPublico>;
	confirmarPagamento(id: string, metodo: MetodoPagamento): Promise<PedidoPublico>;
	cancelarPedido(id: string): Promise<PedidoPublico>;
}

// ─── Regras comuns ao mock e à ponte ────────────────────

/** Limite por item num pedido do site, para evitar que alguém trave o estoque inteiro. */
export const MAX_QUANTIDADE_POR_ITEM = 5;
export const MAX_ITENS_POR_PEDIDO = 20;

/** Valida nome, WhatsApp e itens; devolve os dados limpos e os itens agrupados por produto. */
export function validarPedido(input: CriarPedidoInput) {
	const nome = String(input.nomeContato ?? '').trim().replace(/\s+/g, ' ');
	let telefone = String(input.telefoneContato ?? '').replace(/\D/g, '');
	if (telefone.length >= 12 && telefone.startsWith('55')) telefone = telefone.slice(2);
	if (nome.length < 2 || nome.length > 80) {
		throw new PdvError('CONTATO_INVALIDO', 'Informe um nome com 2 a 80 caracteres.');
	}
	if (!/^[1-9]{2}9?\d{8}$/.test(telefone)) {
		throw new PdvError('CONTATO_INVALIDO', 'Informe um WhatsApp com DDD.');
	}
	if (!Array.isArray(input.itens) || input.itens.length === 0) {
		throw new PdvError('ITEM_INVALIDO', 'A sacola está vazia.');
	}
	const quantidades = new Map<string, number>();
	for (const item of input.itens) {
		const qtd = Number(item?.quantidade);
		const id = typeof item?.produtoId === 'string' ? item.produtoId : '';
		if (!id || id.length > 64 || !Number.isInteger(qtd) || qtd < 1) {
			throw new PdvError('ITEM_INVALIDO', 'Item inválido na sacola.', 400, { produtoId: item?.produtoId });
		}
		quantidades.set(id, (quantidades.get(id) ?? 0) + qtd);
	}
	if (quantidades.size > MAX_ITENS_POR_PEDIDO) {
		throw new PdvError('ITEM_INVALIDO', `No máximo ${MAX_ITENS_POR_PEDIDO} produtos diferentes por pedido.`);
	}
	return { nome, telefone, quantidades };
}

/** Primeiro nome e só os 4 últimos dígitos do telefone: o suficiente para conferir no balcão. */
export const mascararNome = (nome: string) => nome.split(/\s+/)[0];
export const mascararTelefone = (telefone: string) => `•••• ${telefone.slice(-4)}`;
