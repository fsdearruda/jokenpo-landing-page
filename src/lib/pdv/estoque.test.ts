import { describe, expect, it } from 'vitest';
import { calcularDemanda, disponivelNoSite, promocaoVigente } from './estoque';
import type { ComponenteKit } from './sync';

const kit: ComponenteKit[] = [
	{ produtoId: 'energy', quantidade: 1, disponivel: 5 },
	{ produtoId: 'supporter', quantidade: 2, disponivel: 7 },
];
const composicao = new Map([['kit', kit]]);

describe('disponível no site', () => {
	it('desconta os pedidos que o PDV ainda não aplicou', () => {
		const demanda = calcularDemanda([{ itens: [{ produtoId: 'shield', quantidade: 2 }] }], composicao);
		expect(disponivelNoSite({ produto_id: 'shield', disponivel: 5, componentes: null }, demanda)).toBe(3);
	});

	it('nunca fica negativo', () => {
		const demanda = calcularDemanda([{ itens: [{ produtoId: 'shield', quantidade: 9 }] }], composicao);
		expect(disponivelNoSite({ produto_id: 'shield', disponivel: 5, componentes: null }, demanda)).toBe(0);
	});

	it('kit: pedido de kit desconta os componentes, e o kit vale pelo componente que acaba primeiro', () => {
		const demanda = calcularDemanda([{ itens: [{ produtoId: 'kit', quantidade: 1 }] }], composicao);
		expect(demanda.get('energy')).toBe(1);
		expect(demanda.get('supporter')).toBe(2);
		// supporter: (7 - 2) / 2 = 2 kits; energy: 5 - 1 = 4
		expect(disponivelNoSite({ produto_id: 'kit', disponivel: 99, componentes: kit }, demanda)).toBe(2);
	});

	it('kit e componente avulso disputam as mesmas unidades', () => {
		const demanda = calcularDemanda([{ itens: [{ produtoId: 'energy', quantidade: 4 }] }], composicao);
		expect(disponivelNoSite({ produto_id: 'kit', disponivel: 99, componentes: kit }, demanda)).toBe(1);
	});
});

describe('selo de promoção', () => {
	const promo = { id: 'bf', nome: 'Black Friday', precoOriginalCentavos: 6990, terminaEm: '2026-11-30T03:00:00.000Z' };
	it('aparece enquanto vale e some no fim, mesmo sem novo envio do PDV', () => {
		expect(promocaoVigente(promo, Date.parse('2026-11-29T00:00:00Z'))).toBe(promo);
		expect(promocaoVigente(promo, Date.parse('2026-11-30T03:00:00Z'))).toBeNull();
	});
});
