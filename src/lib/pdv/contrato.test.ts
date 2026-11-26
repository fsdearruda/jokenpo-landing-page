import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assinar, assinaturaValida, lerEnvioEstoque, lerResultados, type EnvioEstoque } from './sync';

// Exemplos de mensagens do PDV (contract-fixtures/, copiados com `pnpm sync:contract`)
const exemplo = (nome: string): unknown => JSON.parse(readFileSync(new URL(`../../../contract-fixtures/${nome}`, import.meta.url), 'utf8'));

describe('contrato com o PDV', () => {
	it('aceita o envio de estoque atual (kit, promoção e pedido) sem perder campos', () => {
		const bruto = exemplo('envio-estoque.json');
		expect(lerEnvioEstoque(bruto)).toEqual(bruto);
	});

	it('continua aceitando o envio de um PDV antigo, sem inventar `promocao`', () => {
		const envio = lerEnvioEstoque(exemplo('envio-estoque-pdv-antigo.json')) as EnvioEstoque;
		expect(envio.itens).toHaveLength(1);
		expect(envio.itens[0]).not.toHaveProperty('promocao');
	});

	it('aceita o ack do PDV', () => {
		expect(lerResultados(exemplo('ack.json'))?.map((r) => r.status)).toEqual(['APLICADO', 'RECUSADO', 'RECUSADO']);
	});

	it('promoção inválida vira null (sem selo) em vez de recusar o envio', () => {
		const bruto = exemplo('envio-estoque.json') as { itens: Record<string, unknown>[] };
		bruto.itens[0].promocao = { id: 'x', nome: 'Promo', precoOriginalCentavos: 1, terminaEm: '2026-12-01T00:00:00Z' };
		expect(lerEnvioEstoque(bruto)?.itens[0].promocao).toBeNull();
	});

	it('assinatura do PDV confere e expira em 5 minutos', () => {
		const segredo = 's'.repeat(40);
		const ts = String(Date.parse('2026-11-28T12:00:00Z'));
		const corpo = JSON.stringify(exemplo('envio-estoque.json'));
		const a = assinar(segredo, ts, 'POST', '/api/pdv-sync/estoque', corpo);
		expect(assinaturaValida(segredo, ts, 'POST', '/api/pdv-sync/estoque', corpo, a, Number(ts) + 60_000)).toBe(true);
		expect(assinaturaValida(segredo, ts, 'POST', '/api/pdv-sync/estoque', corpo, a, Number(ts) + 6 * 60_000)).toBe(false);
	});
});
