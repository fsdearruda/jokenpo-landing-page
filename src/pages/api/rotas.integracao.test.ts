import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from '../../lib/db';
import { receberEstoque } from '../../lib/pdv/cloud';
import { POST as criarPedido } from './pdv/pedidos/index';
import { GET as buscarPedido } from './pdv/pedidos/[id]/index';
import { GET as manutencao } from './pdv-sync/manutencao';
import { GET as saude } from './pdv-sync/saude';

// As rotas recebem um contexto do Astro; nos testes só importam request, params e clientAddress
type Ctx = Parameters<typeof criarPedido>[0];
const ctx = (request: Request, extra: Record<string, unknown> = {}) => ({ request, clientAddress: '10.1.1.1', params: {}, ...extra }) as unknown as Ctx;
const post = (body: unknown, tipo = 'application/json') =>
	new Request('http://localhost/api/pdv/pedidos', { method: 'POST', headers: { 'content-type': tipo }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const agendador = (path: string, auth?: string) => new Request(`http://localhost${path}`, { headers: auth ? { authorization: auth } : {} });

beforeEach(async () => {
	const db = sql();
	await db`TRUNCATE pdv_produto, pdv_pedido, pdv_evento, pdv_limite_ip`;
	await db`UPDATE pdv_sync SET pdv_seq = 0, eventos_aplicados_ate = 0, ultimo_contato_em = NULL, ultimo_estoque_em = NULL, alerta_chave = ''`;
	await receberEstoque({
		pdvSeq: 1,
		completo: true,
		eventosAplicadosAte: 0,
		geradoEm: new Date().toISOString(),
		pedidos: [],
		itens: [{ produtoId: 'p1', sku: null, nome: 'Shield', categoria: null, grupo: null, precoCentavos: 2500, disponivel: 3, noCatalogo: true, atualizadoEm: new Date().toISOString() }],
	});
});

afterAll(async () => {
	await sql().end();
});

describe('POST /api/pdv/pedidos', () => {
	it('cria o pedido e o cliente consegue acompanhar', async () => {
		const r = await criarPedido(ctx(post({ itens: [{ produtoId: 'p1', quantidade: 1 }], nomeContato: 'Ana Souza', telefoneContato: '(84) 9 9999-0000' })));
		expect(r.status).toBe(200);
		expect(r.headers.get('cache-control')).toBe('no-store');
		const pedido = await r.json();
		expect(pedido).toMatchObject({ status: 'AGUARDANDO_CONFIRMACAO', totalCentavos: 2500, telefoneContato: expect.stringMatching(/0000$/) });

		const lido = await buscarPedido(ctx(new Request(`http://localhost/api/pdv/pedidos/${pedido.id}`), { params: { id: pedido.id } }));
		expect((await lido.json()).id).toBe(pedido.id);
	});

	it('recusa formato errado, JSON quebrado e contato inválido', async () => {
		expect((await criarPedido(ctx(post('x=1', 'application/x-www-form-urlencoded')))).status).toBe(415);
		expect((await criarPedido(ctx(post('{quebrado')))).status).toBe(400);
		const r = await criarPedido(ctx(post({ itens: [{ produtoId: 'p1', quantidade: 1 }], nomeContato: 'A', telefoneContato: '123' })));
		expect(r.status).toBe(400);
		expect((await r.json()).erro.codigo).toBe('CONTATO_INVALIDO');
	});

	it('responde 409 com o disponível quando falta estoque', async () => {
		const r = await criarPedido(ctx(post({ itens: [{ produtoId: 'p1', quantidade: 4 }], nomeContato: 'Ana Souza', telefoneContato: '84999990000' })));
		expect(r.status).toBe(409);
		expect((await r.json()).erro).toMatchObject({ codigo: 'ESTOQUE_INSUFICIENTE', detalhes: [{ produtoId: 'p1', disponivel: 3 }] });
	});
});

describe('rotas do Vercel Schedules', () => {
	it('exigem o CRON_SECRET', async () => {
		expect((await manutencao(ctx(agendador('/api/pdv-sync/manutencao')))).status).toBe(401);
		expect((await manutencao(ctx(agendador('/api/pdv-sync/manutencao', 'Bearer errado')))).status).toBe(401);
		expect((await saude(ctx(agendador('/api/pdv-sync/saude')))).status).toBe(401);
	});

	it('faxina roda com o segredo', async () => {
		const r = await manutencao(ctx(agendador('/api/pdv-sync/manutencao', `Bearer ${process.env.CRON_SECRET}`)));
		expect(r.status).toBe(200);
		expect(await r.json()).toMatchObject({ ok: true, fotosApagadas: 0 });
	});

	it('saúde em dia não manda e-mail', async () => {
		const r = await saude(ctx(agendador('/api/pdv-sync/saude', `Bearer ${process.env.CRON_SECRET}`)));
		expect(await r.json()).toMatchObject({ ok: true, problemas: [], emailEnviado: false });
	});
});
