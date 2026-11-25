import { randomUUID } from 'node:crypto';
import { families, variantsById } from '../catalog';
import {
	MAX_QUANTIDADE_POR_ITEM,
	PdvError,
	mascararNome,
	mascararTelefone,
	validarPedido,
	type CriarPedidoInput,
	type EstoqueItem,
	type MetodoPagamento,
	type PdvClient,
	type PedidoPublico,
} from './types';

export { MAX_QUANTIDADE_POR_ITEM };

/** Prazo para pagar depois que a loja confirma o estoque. */
export const PRAZO_PAGAMENTO_HORAS = 48;

/**
 * Mock em memória do PDV, para desenvolver a vitrine sem o PC da loja.
 *
 * O estado vive só no processo do servidor: reinicia a cada deploy e a cada cold
 * start, e não é compartilhado entre instâncias. A "loja" confirma na hora: o pedido
 * nasce em `PAGAMENTO_PENDENTE`. Os dados de contato saem mascarados.
 */
class MockPdv implements PdvClient {
	private estoque = new Map<string, number>();
	private pedidos = new Map<string, PedidoPublico>();
	private proximoNumero = 1;

	constructor() {
		for (const family of families) {
			for (const variant of family.variants) this.estoque.set(variant.id, variant.stock);
		}
	}

	async listarEstoque(): Promise<EstoqueItem[]> {
		this.expirar();
		return [...this.estoque].map(([produtoId, disponivel]) => ({
			produtoId,
			disponivel,
			precoCentavos: variantsById.get(produtoId)?.variant.priceCents ?? 0,
		}));
	}

	async listarCatalogo() {
		return null;
	}

	async criarPedido(input: CriarPedidoInput): Promise<PedidoPublico> {
		this.expirar();
		const { nome, telefone, quantidades } = validarPedido(input);
		for (const id of quantidades.keys()) {
			if (!variantsById.has(id)) throw new PdvError('ITEM_INVALIDO', 'Item inválido na sacola.', 400, { produtoId: id });
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
			this.estoque.set(produtoId, (this.estoque.get(produtoId) ?? 0) - quantidade);
			return {
				produtoId,
				descricao: variant.title,
				quantidade,
				precoUnitarioCentavos: variant.priceCents,
				totalCentavos: variant.priceCents * quantidade,
			};
		});
		const pedido: PedidoPublico = {
			id: randomUUID(),
			numero: this.proximoNumero++,
			status: 'PAGAMENTO_PENDENTE',
			itens,
			totalCentavos: itens.reduce((sum, item) => sum + item.totalCentavos, 0),
			nomeContato: mascararNome(nome),
			telefoneContato: mascararTelefone(telefone),
			validoAte: new Date(agora.getTime() + PRAZO_PAGAMENTO_HORAS * 3_600_000).toISOString(),
			motivo: null,
			criadoEm: agora.toISOString(),
		};
		this.pedidos.set(pedido.id, pedido);
		return structuredClone(pedido);
	}

	async buscarPedido(id: string): Promise<PedidoPublico> {
		this.expirar();
		return structuredClone(this.obter(id));
	}

	async confirmarPagamento(id: string, _metodo: MetodoPagamento): Promise<PedidoPublico> {
		this.expirar();
		const pedido = this.obter(id);
		if (pedido.status !== 'PAGAMENTO_PENDENTE') throw new PdvError('STATUS_INVALIDO', `Pedido está ${pedido.status}.`, 409);
		pedido.status = 'PAGO';
		pedido.validoAte = null;
		return structuredClone(pedido);
	}

	async cancelarPedido(id: string): Promise<PedidoPublico> {
		this.expirar();
		const pedido = this.obter(id);
		if (pedido.status !== 'PAGAMENTO_PENDENTE') throw new PdvError('STATUS_INVALIDO', `Pedido está ${pedido.status}.`, 409);
		this.liberar(pedido, 'CANCELADO');
		return structuredClone(pedido);
	}

	private obter(id: string) {
		const pedido = this.pedidos.get(id);
		if (!pedido) throw new PdvError('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404);
		return pedido;
	}

	private liberar(pedido: PedidoPublico, status: 'CANCELADO' | 'EXPIRADO') {
		for (const item of pedido.itens) this.estoque.set(item.produtoId, (this.estoque.get(item.produtoId) ?? 0) + item.quantidade);
		pedido.status = status;
	}

	private expirar() {
		const agora = Date.now();
		for (const pedido of this.pedidos.values()) {
			if (pedido.status === 'PAGAMENTO_PENDENTE' && pedido.validoAte && Date.parse(pedido.validoAte) <= agora) {
				this.liberar(pedido, 'EXPIRADO');
			}
		}
	}
}

// Uma instância por processo, preservada entre hot reloads do `astro dev`.
const globalStore = globalThis as typeof globalThis & { __jokenpoMockPdv?: MockPdv };
export const mockPdv: PdvClient = (globalStore.__jokenpoMockPdv ??= new MockPdv());
