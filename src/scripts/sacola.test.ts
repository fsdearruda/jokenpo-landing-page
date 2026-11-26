import { describe, expect, it } from 'vitest';
import { ehEstoque, ehLinha, ehPedido, erroDa } from './sacola';

const pedido = {
	id: 'a1',
	numero: 12,
	status: 'PAGAMENTO_PENDENTE',
	itens: [{ descricao: 'Shield', quantidade: 2, precoUnitarioCentavos: 2500 }],
	totalCentavos: 5000,
	validoAte: null,
	motivo: null,
	descontoPixBp: 500,
};

describe('guardas da sacola', () => {
	it('linha da sacola', () => {
		expect(ehLinha({ id: 'p1', qty: 2 })).toBe(true);
		expect(ehLinha({ id: 'p1', qty: 0 })).toBe(false);
		expect(ehLinha({ id: 'p1', qty: '2' })).toBe(false);
		expect(ehLinha(null)).toBe(false);
	});
	it('pedido salvo ou vindo da API', () => {
		expect(ehPedido(pedido)).toBe(true);
		expect(ehPedido({ ...pedido, descontoPixBp: undefined })).toBe(true);
		expect(ehPedido({ ...pedido, status: 'SUMIU' })).toBe(false);
		expect(ehPedido({ ...pedido, itens: 'x' })).toBe(false);
		expect(ehPedido({ ...pedido, descontoPixBp: 'cinco' })).toBe(false);
	});
	it('estoque ao vivo e erro da API', () => {
		expect(ehEstoque({ produtoId: 'p1', disponivel: 3, precoCentavos: 990 })).toBe(true);
		expect(ehEstoque({ produtoId: 'p1', disponivel: 'muito' })).toBe(false);
		expect(erroDa({ erro: { codigo: 'X', mensagem: 1 } })).toEqual({ codigo: 'X', mensagem: undefined, detalhes: undefined });
		expect(erroDa('quebrado')).toBeUndefined();
	});
});
