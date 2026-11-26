import { describe, expect, it } from 'vitest';
import { calcularDemanda, disponivelNoSite, lojaOffline, promocaoVigente } from './estoque';
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

describe('loja sem contato', () => {
	const agora = Date.parse('2026-11-28T20:00:00Z');
	it('pausa os pedidos depois de 6 h sem estoque novo (PC desligado)', () => {
		expect(lojaOffline({ vistaEm: '2026-11-28T15:00:00Z', estoqueEm: '2026-11-28T15:00:00Z' }, agora)).toBe(false);
		expect(lojaOffline({ vistaEm: '2026-11-28T13:59:00Z', estoqueEm: '2026-11-28T13:59:00Z' }, agora)).toBe(true);
	});
	it('sem nenhum estoque aceito conta como offline', () => {
		expect(lojaOffline({ vistaEm: null, estoqueEm: null }, agora)).toBe(true);
		expect(lojaOffline({ vistaEm: '2026-11-28T19:59:00Z', estoqueEm: null }, agora)).toBe(true);
	});
	it('pausa quando o PC busca pedidos mas o estoque está sendo recusado há mais de 30 min', () => {
		expect(lojaOffline({ vistaEm: '2026-11-28T19:59:45Z', estoqueEm: '2026-11-28T19:35:00Z' }, agora)).toBe(false);
		expect(lojaOffline({ vistaEm: '2026-11-28T19:59:45Z', estoqueEm: '2026-11-28T19:29:00Z' }, agora)).toBe(true);
	});
});

describe('preço no Pix', async () => {
	const { pixPrice } = await import('../catalog');
	const { precoPix } = await import('./sync');
	it('desconto sobre o preço do PDV (cartão), arredondado ao centavo, igual à conta do PDV', () => {
		expect(pixPrice(6990, { pixDiscountPercent: 5 })).toBe(6641);
		expect(pixPrice(6990, { pixDiscountPercent: 0 })).toBe(6990);
		for (const c of [100, 999, 2500, 6990, 10949]) expect(pixPrice(c, { pixDiscountPercent: 5 })).toBe(precoPix(c, 500));
	});
});
