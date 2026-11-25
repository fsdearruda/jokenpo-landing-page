import { randomUUID } from 'node:crypto';
import { families, variantsById } from '../catalog';
import {
	PdvError,
	type CriarPedidoInput,
	type EstoqueItem,
	type MetodoPagamento,
	type MovimentoEstoque,
	type PdvClient,
	type PedidoPublico,
	type TipoMovimentoEstoque,
} from './types';

/** Tempo que uma reserva segura o estoque antes de expirar. */
export const RESERVA_VALIDADE_HORAS = 48;
/** Limite por item numa reserva do site, para evitar que alguém trave o estoque inteiro. */
export const MAX_QUANTIDADE_POR_ITEM = 5;

interface PedidoInterno extends Omit<PedidoPublico, 'nomeContato' | 'telefoneContato'> {
	nomeContato: string;
	telefoneContato: string;
}

/**
 * Mock em memória da API do PDV.
 *
 * O estado vive só no processo do servidor: reinicia a cada deploy, a cada
 * cold start da função na Vercel e não é compartilhado entre instâncias.
 * Serve para desenvolver a vitrine e o fluxo de reserva sem tocar no banco
 * real. Os dados de contato ficam só em memória e saem mascarados.
 */
class MockPdv implements PdvClient {
	private estoque = new Map<string, number>();
	private pedidos = new Map<string, PedidoInterno>();
	private proximoNumero = 1;

	constructor() {
		for (const family of families) {
			for (const variant of family.variants) this.estoque.set(variant.id, variant.stock);
		}
	}

	async listarEstoque(): Promise<EstoqueItem[]> {
		this.expirarReservas();
		return [...this.estoque].map(([produtoId, disponivel]) => ({ produtoId, disponivel }));
	}

	async criarPedido(input: CriarPedidoInput): Promise<PedidoPublico> {
		this.expirarReservas();
		const nome = input.nomeContato?.trim() ?? '';
		const telefone = (input.telefoneContato ?? '').replace(/\D/g, '');
		if (nome.length < 2 || nome.length > 80) {
			throw new PdvError('CONTATO_INVALIDO', 'Informe um nome com 2 a 80 caracteres.');
		}
		if (!/^(55)?\d{10,11}$/.test(telefone)) {
			throw new PdvError('CONTATO_INVALIDO', 'Informe um WhatsApp com DDD.');
		}
		if (!Array.isArray(input.itens) || input.itens.length === 0) {
			throw new PdvError('ITEM_INVALIDO', 'A sacola está vazia.');
		}

		// Agrupa itens repetidos e valida tudo antes de mexer no estoque.
		const quantidades = new Map<string, number>();
		for (const item of input.itens) {
			const qtd = Number(item?.quantidade);
			if (!variantsById.has(item?.produtoId) || !Number.isInteger(qtd) || qtd < 1) {
				throw new PdvError('ITEM_INVALIDO', 'Item inválido na sacola.', 400, { produtoId: item?.produtoId });
			}
			quantidades.set(item.produtoId, (quantidades.get(item.produtoId) ?? 0) + qtd);
		}
		const faltando = [...quantidades]
			.filter(([id, qtd]) => qtd > MAX_QUANTIDADE_POR_ITEM || qtd > (this.estoque.get(id) ?? 0))
			.map(([produtoId]) => ({ produtoId, disponivel: Math.min(this.estoque.get(produtoId) ?? 0, MAX_QUANTIDADE_POR_ITEM) }));
		if (faltando.length > 0) {
			const nomes = faltando.map(({ produtoId }) => variantsById.get(produtoId)!.variant.title).join(', ');
			throw new PdvError('ESTOQUE_INSUFICIENTE', `Sem estoque suficiente pra: ${nomes}.`, 409, faltando);
		}

		const agora = new Date();
		const itens = [...quantidades].map(([produtoId, quantidade]) => {
			const { variant } = variantsById.get(produtoId)!;
			return {
				produtoId,
				descricao: variant.title,
				quantidade,
				precoUnitarioCentavos: variant.priceCents,
				totalCentavos: variant.priceCents * quantidade,
				reservado: true,
			};
		});
		const pedido: PedidoInterno = {
			id: randomUUID(),
			numero: this.proximoNumero++,
			tipo: 'PEDIDO',
			origem: 'CATALOGO',
			status: 'ABERTO',
			itens,
			totalCentavos: itens.reduce((sum, item) => sum + item.totalCentavos, 0),
			nomeContato: nome,
			telefoneContato: telefone,
			validoAte: new Date(agora.getTime() + RESERVA_VALIDADE_HORAS * 3_600_000).toISOString(),
			criadoEm: agora.toISOString(),
			movimentos: [],
		};
		for (const item of itens) this.movimentar(pedido, item.produtoId, 'RESERVA', -item.quantidade);
		this.pedidos.set(pedido.id, pedido);
		return publico(pedido);
	}

	async buscarPedido(id: string): Promise<PedidoPublico> {
		this.expirarReservas();
		return publico(this.obter(id));
	}

	async confirmarPagamento(id: string, _metodo: MetodoPagamento): Promise<PedidoPublico> {
		this.expirarReservas();
		const pedido = this.obter(id);
		if (pedido.status !== 'ABERTO') {
			throw new PdvError('STATUS_INVALIDO', `Pedido está ${pedido.status}.`, 409);
		}
		// A unidade já saiu do disponível na reserva; aqui ela vira venda de fato.
		for (const item of pedido.itens) {
			item.reservado = false;
			pedido.movimentos.push(movimento(item.produtoId, 'VENDA', -item.quantidade));
		}
		pedido.status = 'CONFIRMADO';
		return publico(pedido);
	}

	async cancelarPedido(id: string): Promise<PedidoPublico> {
		this.expirarReservas();
		const pedido = this.obter(id);
		if (pedido.status !== 'ABERTO') {
			throw new PdvError('STATUS_INVALIDO', `Pedido está ${pedido.status}.`, 409);
		}
		this.liberar(pedido, 'CANCELADO');
		return publico(pedido);
	}

	private obter(id: string) {
		const pedido = this.pedidos.get(id);
		if (!pedido) throw new PdvError('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404);
		return pedido;
	}

	private movimentar(pedido: PedidoInterno, produtoId: string, tipo: TipoMovimentoEstoque, quantidade: number) {
		this.estoque.set(produtoId, (this.estoque.get(produtoId) ?? 0) + quantidade);
		pedido.movimentos.push(movimento(produtoId, tipo, quantidade));
	}

	private liberar(pedido: PedidoInterno, status: 'CANCELADO' | 'EXPIRADO') {
		for (const item of pedido.itens) {
			item.reservado = false;
			this.movimentar(pedido, item.produtoId, 'LIBERACAO', item.quantidade);
		}
		pedido.status = status;
	}

	private expirarReservas() {
		const agora = Date.now();
		for (const pedido of this.pedidos.values()) {
			if (pedido.status === 'ABERTO' && Date.parse(pedido.validoAte) <= agora) this.liberar(pedido, 'EXPIRADO');
		}
	}
}

const movimento = (produtoId: string, tipo: TipoMovimentoEstoque, quantidade: number): MovimentoEstoque => ({
	produtoId,
	tipo,
	quantidade,
	criadoEm: new Date().toISOString(),
});

/** Primeiro nome e só os 4 últimos dígitos do telefone: o suficiente para conferir no balcão. */
const publico = (pedido: PedidoInterno): PedidoPublico => ({
	...pedido,
	itens: pedido.itens.map((item) => ({ ...item })),
	movimentos: [...pedido.movimentos],
	nomeContato: pedido.nomeContato.split(/\s+/)[0],
	telefoneContato: `•••• ${pedido.telefoneContato.slice(-4)}`,
});

// Uma instância por processo, preservada entre hot reloads do `astro dev`.
const globalStore = globalThis as typeof globalThis & { __jokenpoMockPdv?: MockPdv };
export const mockPdv: PdvClient = (globalStore.__jokenpoMockPdv ??= new MockPdv());
