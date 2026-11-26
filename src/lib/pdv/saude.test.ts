import { describe, expect, it } from 'vitest';
import { chaveDoAlerta, mensagemDoAlerta, problemasDaSincronizacao, type EstadoSync } from './saude';

const agora = Date.parse('2026-11-28T20:00:00Z');
const ha = (min: number) => new Date(agora - min * 60_000);
const ok: EstadoSync = { vistaEm: ha(0.25), estoqueEm: ha(5), pendentes: 0, pendenteDesde: null };

describe('saúde da sincronização', () => {
	it('tudo em dia não tem problema', () => {
		expect(problemasDaSincronizacao(ok, agora)).toEqual([]);
		expect(problemasDaSincronizacao({ ...ok, pendentes: 2, pendenteDesde: ha(10) }, agora)).toEqual([]);
	});
	it('PC sumido', () => {
		expect(problemasDaSincronizacao({ ...ok, vistaEm: ha(31), estoqueEm: ha(31) }, agora)).toEqual(['PC_SEM_CONTATO']);
		expect(problemasDaSincronizacao({ vistaEm: null, estoqueEm: null, pendentes: 0, pendenteDesde: null }, agora)).toEqual(['PC_SEM_CONTATO']);
	});
	it('PC conectado com o estoque recusado', () => {
		expect(problemasDaSincronizacao({ ...ok, estoqueEm: ha(45) }, agora)).toEqual(['ESTOQUE_PARADO']);
	});
	it('pedido esperando o PC há mais de 30 min', () => {
		expect(problemasDaSincronizacao({ ...ok, pendentes: 1, pendenteDesde: ha(40) }, agora)).toEqual(['PEDIDOS_PARADOS']);
	});
	it('a chave não depende da ordem e a mensagem cobre a volta ao normal', () => {
		expect(chaveDoAlerta(['PEDIDOS_PARADOS', 'ESTOQUE_PARADO'])).toBe(chaveDoAlerta(['ESTOQUE_PARADO', 'PEDIDOS_PARADOS']));
		expect(chaveDoAlerta([])).toBe('');
		expect(mensagemDoAlerta([], ok).assunto).toMatch(/voltou ao normal/);
		expect(mensagemDoAlerta(['ESTOQUE_PARADO'], ok).texto).toMatch(/relógio do PC/);
	});
	it('mostra a versão do contrato de cada lado', () => {
		expect(mensagemDoAlerta([], { ...ok, versaoPdv: 2 }, 2).texto).toMatch(/PC 2, site 2\n/);
		expect(mensagemDoAlerta([], { ...ok, versaoPdv: null }, 2).texto).toMatch(/PC anterior à 2, site 2 \(atualize o PDV\)/);
	});
});
