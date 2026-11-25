/**
 * Contrato da integração com o PDV (ponto de venda).
 *
 * Os nomes seguem o schema do banco `comanda` (Prisma): `Pedido`,
 * `ItemPedido` e `MovimentoEstoque`. Uma reserva feita pelo site vira um
 * `Pedido` com `origem = CATALOGO`, itens com `reservado = true` e movimentos
 * `RESERVA`. Quando o pagamento é confirmado, a reserva vira `VENDA`; quando
 * expira ou é cancelada, o estoque volta com `LIBERACAO`.
 */

export type StatusPedido = 'ABERTO' | 'CONFIRMADO' | 'PRONTO' | 'ENTREGUE' | 'CANCELADO' | 'EXPIRADO';
export type TipoMovimentoEstoque = 'ENTRADA' | 'VENDA' | 'ESTORNO' | 'DEVOLUCAO' | 'AJUSTE' | 'RESERVA' | 'LIBERACAO';
export type MetodoPagamento = 'PIX' | 'DEBITO' | 'CREDITO' | 'DINHEIRO';

export interface EstoqueItem {
	produtoId: string;
	disponivel: number;
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
	reservado: boolean;
}

export interface MovimentoEstoque {
	produtoId: string;
	tipo: TipoMovimentoEstoque;
	/**
	 * Sinal indica saída (−) ou volta (+). `RESERVA` tira do disponível,
	 * `VENDA` registra a saída física (o disponível já baixou na reserva) e
	 * `LIBERACAO` devolve ao disponível.
	 */
	quantidade: number;
	criadoEm: string;
}

/** Visão pública de um pedido. Telefone e nome nunca voltam completos. */
export interface PedidoPublico {
	id: string;
	numero: number;
	tipo: 'PEDIDO';
	origem: 'CATALOGO';
	status: StatusPedido;
	itens: ItemPedido[];
	totalCentavos: number;
	nomeContato: string;
	telefoneContato: string;
	validoAte: string;
	criadoEm: string;
	movimentos: MovimentoEstoque[];
}

export type PdvErrorCode = 'ITEM_INVALIDO' | 'ESTOQUE_INSUFICIENTE' | 'CONTATO_INVALIDO' | 'PEDIDO_NAO_ENCONTRADO' | 'STATUS_INVALIDO';

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

/** Operações que o site precisa do PDV. O mock e a futura API real implementam a mesma interface. */
export interface PdvClient {
	listarEstoque(): Promise<EstoqueItem[]>;
	criarPedido(input: CriarPedidoInput): Promise<PedidoPublico>;
	buscarPedido(id: string): Promise<PedidoPublico>;
	confirmarPagamento(id: string, metodo: MetodoPagamento): Promise<PedidoPublico>;
	cancelarPedido(id: string): Promise<PedidoPublico>;
}
