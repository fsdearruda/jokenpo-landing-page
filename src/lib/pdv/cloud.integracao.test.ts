import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from '../db';
import { confirmarEventos, contatoDaLoja, estadoDaSincronizacao, cloudPdv, listarEventos, manutencao, receberEstoque } from './cloud';
import { dentroDoLimite, LIMITE_PEDIDOS } from './limite';
import type { EnvioEstoque, ItemFoto } from './sync';
import { PdvError } from './types';

const item = (id: string, disponivel: number, extra: Partial<ItemFoto> = {}): ItemFoto => ({
	produtoId: id,
	sku: null,
	nome: `Produto ${id}`,
	categoria: 'Shields',
	grupo: 'Acessórios',
	precoCentavos: 1000,
	disponivel,
	noCatalogo: true,
	atualizadoEm: new Date().toISOString(),
	...extra,
});

let seq = 0;
const envio = (itens: ItemFoto[], extra: Partial<EnvioEstoque> = {}): EnvioEstoque => ({
	pdvSeq: ++seq,
	completo: true,
	eventosAplicadosAte: 0,
	geradoEm: new Date().toISOString(),
	itens,
	pedidos: [],
	loja: { acrescimoCartaoBp: 0, descontoPixBp: 500 },
	...extra,
});

const pedir = (itens: { produtoId: string; quantidade: number }[], telefone = `8499${Math.floor(1_000_000 + Math.random() * 8_999_999)}`) =>
	cloudPdv.criarPedido({ itens, nomeContato: 'Ana Souza', telefoneContato: telefone });

const erroDe = async (p: Promise<unknown>) => {
	try {
		await p;
	} catch (e) {
		return e instanceof PdvError ? e.code : String(e);
	}
	return null;
};

beforeEach(async () => {
	const db = sql();
	await db`TRUNCATE pdv_produto, pdv_pedido, pdv_evento, pdv_limite_ip`;
	await db`UPDATE pdv_sync SET pdv_seq = 0, eventos_aplicados_ate = 0, ultimo_contato_em = NULL, ultimo_estoque_em = NULL, ultimo_gerado_em = NULL, desconto_pix_bp = NULL, alerta_chave = ''`;
	seq = 0;
});

afterAll(async () => {
	await sql().end();
});

describe('envio de estoque', () => {
	it('aceita pelo contador e recusa reenvio, devolvendo o contador do site', async () => {
		const primeiro = envio([item('p1', 3)]);
		expect(await receberEstoque(primeiro, 2)).toEqual({ aceito: true });
		expect(await receberEstoque(primeiro)).toEqual({ aceito: false, pdvSeq: primeiro.pdvSeq });
		const contato = await contatoDaLoja();
		expect(contato.estoqueEm).not.toBeNull();
		expect((await estadoDaSincronizacao()).versaoPdv).toBe(2);
	});

	it('não decide pelo relógio do PC: envio com data atrasada e contador maior passa', async () => {
		await receberEstoque(envio([item('p1', 3)]));
		const atrasado = envio([item('p1', 2)], { completo: false, geradoEm: '2020-01-01T00:00:00.000Z' });
		expect(await receberEstoque(atrasado)).toEqual({ aceito: true });
		expect((await cloudPdv.listarEstoque())[0].disponivel).toBe(2);
	});

	it('foto completa esconde o que saiu do catálogo e grava o desconto no Pix', async () => {
		await receberEstoque(envio([item('p1', 3), item('p2', 1)]));
		await receberEstoque(envio([item('p1', 3)]));
		expect((await cloudPdv.listarCatalogo()).map((p) => p.produtoId)).toEqual(['p1']);
		expect((await sql()`SELECT desconto_pix_bp FROM pdv_sync`)[0].desconto_pix_bp).toBe(500);
	});
});

describe('pedido no site', () => {
	it('desconta da vitrine, guarda o desconto do momento e vai para o PDV no evento', async () => {
		await receberEstoque(envio([item('p1', 3)]));
		const pedido = await pedir([{ produtoId: 'p1', quantidade: 2 }]);
		expect(pedido.status).toBe('AGUARDANDO_CONFIRMACAO');
		expect(pedido.descontoPixBp).toBe(500);
		expect((await cloudPdv.listarEstoque())[0].disponivel).toBe(1);

		const [evento] = await listarEventos(0, 10);
		expect(evento.payload).toMatchObject({ descontoPixBp: 500, itens: [{ produtoId: 'p1', quantidade: 2, precoUnitarioCentavos: 1000 }] });

		// A foto que já inclui a reserva não desconta duas vezes
		await receberEstoque(envio([item('p1', 1)], { eventosAplicadosAte: evento.id }));
		expect((await cloudPdv.listarEstoque())[0].disponivel).toBe(1);
	});

	it('recusa sem estoque, item fora da loja e loja sem estoque recente', async () => {
		await receberEstoque(envio([item('p1', 1)]));
		expect(await erroDe(pedir([{ produtoId: 'p1', quantidade: 2 }]))).toBe('ESTOQUE_INSUFICIENTE');
		expect(await erroDe(pedir([{ produtoId: 'nao-existe', quantidade: 1 }]))).toBe('ITEM_INVALIDO');

		// PC conectado (buscando pedidos) mas sem estoque aceito há mais de 30 min: pausa
		await sql()`UPDATE pdv_sync SET ultimo_estoque_em = now() - interval '45 minutes', ultimo_contato_em = now()`;
		expect(await erroDe(pedir([{ produtoId: 'p1', quantidade: 1 }]))).toBe('LOJA_OFFLINE');
	});

	it('kit e componente avulso disputam as mesmas unidades', async () => {
		await receberEstoque(
			envio([
				item('comp', 2),
				item('kit', 2, { componentes: [{ produtoId: 'comp', quantidade: 1, disponivel: 2 }] }),
			]),
		);
		expect(await erroDe(pedir([{ produtoId: 'kit', quantidade: 2 }, { produtoId: 'comp', quantidade: 1 }]))).toBe('ESTOQUE_INSUFICIENTE');
		await pedir([{ produtoId: 'kit', quantidade: 1 }]);
		const estoque = new Map((await cloudPdv.listarEstoque()).map((e) => [e.produtoId, e.disponivel]));
		expect(estoque.get('comp')).toBe(1);
		expect(estoque.get('kit')).toBe(1);
	});
});

describe('status vindo do PDV', () => {
	it('só anda para frente', async () => {
		await receberEstoque(envio([item('p1', 3)]));
		const pedido = await pedir([{ produtoId: 'p1', quantidade: 1 }]);
		const [evento] = await listarEventos(0, 10);
		const status = (s: 'PAGAMENTO_PENDENTE' | 'PAGO') => ({ pedidoId: pedido.id, numeroPdv: 7, status: s, validoAte: null, motivo: null });

		await confirmarEventos([{ eventoId: evento.id, status: 'APLICADO', pedido: status('PAGAMENTO_PENDENTE') }]);
		await receberEstoque(envio([item('p1', 2)], { completo: false, pedidos: [status('PAGO')] }));
		expect((await cloudPdv.buscarPedido(pedido.id)).status).toBe('PAGO');

		// Ack repetido e atrasado não volta para pagamento pendente
		await confirmarEventos([{ eventoId: evento.id, status: 'APLICADO', pedido: status('PAGAMENTO_PENDENTE') }]);
		expect((await cloudPdv.buscarPedido(pedido.id)).status).toBe('PAGO');
	});
});

describe('faxina diária', () => {
	it('expira pedido vencido (a leitura já mostra expirado antes) e mascara o contato depois', async () => {
		await receberEstoque(envio([item('p1', 3)]));
		const pedido = await pedir([{ produtoId: 'p1', quantidade: 1 }], '84999990000');
		await sql()`UPDATE pdv_pedido SET criado_em = now() - interval '73 hours' WHERE id = ${pedido.id}`;

		// Leitura pública não grava, mas já mostra expirado e devolve a unidade
		expect((await cloudPdv.buscarPedido(pedido.id)).status).toBe('EXPIRADO');
		expect((await cloudPdv.listarEstoque())[0].disponivel).toBe(3);
		expect((await sql()`SELECT status FROM pdv_pedido WHERE id = ${pedido.id}`)[0].status).toBe('AGUARDANDO_CONFIRMACAO');

		await manutencao();
		expect((await sql()`SELECT status FROM pdv_pedido WHERE id = ${pedido.id}`)[0].status).toBe('EXPIRADO');

		await sql()`UPDATE pdv_pedido SET atualizado_em = now() - interval '2 days' WHERE id = ${pedido.id}`;
		const r = await manutencao();
		expect(r.contatosMascarados).toBe(1);
		const [linha] = await sql()`SELECT nome_contato, telefone_contato FROM pdv_pedido WHERE id = ${pedido.id}`;
		expect(linha).toEqual({ nome_contato: 'Ana', telefone_contato: '0000' });
		const [ev] = await sql()`SELECT payload FROM pdv_evento WHERE pedido_id = ${pedido.id}`;
		expect(ev.payload).not.toHaveProperty('telefoneContato');
	});

	it('devolve as fotos em uso para a faxina do Blob', async () => {
		const foto = 'https://x.public.blob.vercel-storage.com/production/produtos/p1/f1.webp';
		await receberEstoque(
			envio([item('p1', 1, { conteudo: { nomeSite: null, descricao: null, slug: 'p1', destaque: false, fotos: [foto], ordemGrupo: null } })]),
		);
		expect([...(await manutencao()).fotosEmUso]).toEqual([foto]);
	});
});

describe('limite por IP', () => {
	it(`deixa ${LIMITE_PEDIDOS} tentativas por janela`, async () => {
		const ip = `10.0.0.${Math.floor(Math.random() * 200)}`;
		for (let i = 0; i < LIMITE_PEDIDOS; i++) expect(await dentroDoLimite(ip)).toBe(true);
		expect(await dentroDoLimite(ip)).toBe(false);
		expect(await dentroDoLimite(undefined)).toBe(true);
	});
});

describe('pedido inexistente', () => {
	it('responde 404 para id desconhecido ou inválido', async () => {
		expect(await erroDe(cloudPdv.buscarPedido(randomUUID()))).toBe('PEDIDO_NAO_ENCONTRADO');
		expect(await erroDe(cloudPdv.buscarPedido('../etc'))).toBe('PEDIDO_NAO_ENCONTRADO');
	});
});
