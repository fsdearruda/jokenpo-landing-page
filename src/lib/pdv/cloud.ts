import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { sql } from '../db';
import { calcularDemanda, disponivelNoSite, promocaoVigente } from './estoque';
import type { ComponenteKit, EnvioEstoque, PromocaoFoto, ResultadoEvento, StatusPedidoSite } from './sync';
import {
	MAX_ABERTOS_POR_IP,
	MAX_ABERTOS_POR_TELEFONE,
	MAX_QUANTIDADE_POR_ITEM,
	PRAZO_CONFIRMACAO_HORAS,
	PdvError,
	mascararNome,
	mascararTelefone,
	validarPedido,
	type CriarPedidoInput,
	type EstoqueItem,
	type PdvClient,
	type PedidoPublico,
	type ProdutoCatalogo,
	type StatusPedido,
} from './types';

/**
 * PDV real, através da ponte no Postgres (docs/plano-api-pdv.md).
 *
 * O PC da loja envia o estoque e busca os pedidos; aqui o site só lê a cópia e enfileira.
 * Enquanto a loja não confirma um pedido, as unidades dele ficam descontadas da vitrine:
 *
 *   disponível no site = disponível no PDV − pedidos ainda não refletidos na última foto do PDV
 *
 * "Ainda não refletido" = evento depois de `pdv_sync.eventos_aplicados_ate` e pedido não recusado,
 * cancelado ou expirado. Quando a foto que já inclui a reserva chega, a conta não desconta duas vezes.
 */

type Tx = postgres.Sql | postgres.TransactionSql;
type LinhaPedido = {
	id: string;
	numero: number;
	status: StatusPedido;
	itens: PedidoPublico['itens'];
	total_centavos: number;
	nome_contato: string;
	telefone_contato: string;
	valido_ate: Date | null;
	motivo: string | null;
	criado_em: Date;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LinhaProduto = {
	produto_id: string;
	sku: string | null;
	nome: string;
	categoria: string | null;
	grupo: string | null;
	preco_centavos: number;
	disponivel: number;
	componentes: ComponenteKit[] | null;
	promocao?: PromocaoFoto | null;
};

/**
 * Unidades pedidas no site que a última foto do PDV ainda não inclui, por produto.
 * Kit conta nos componentes (é deles que o PDV separa o estoque).
 */
async function demandaPendente(tx: Tx) {
	const [pedidos, kits] = await Promise.all([
		tx<{ itens: { produtoId: string; quantidade: number }[] }[]>`
			SELECT itens FROM pdv_pedido
			WHERE status NOT IN ('RECUSADO', 'CANCELADO', 'EXPIRADO')
				AND evento_id > (SELECT eventos_aplicados_ate FROM pdv_sync WHERE id = 1)`,
		tx<{ produto_id: string; componentes: ComponenteKit[] }[]>`SELECT produto_id, componentes FROM pdv_produto WHERE componentes IS NOT NULL`,
	]);
	return calcularDemanda(pedidos, new Map(kits.map((k) => [k.produto_id, k.componentes])));
}

/**
 * Pedido que a loja não confirmou em 72 h expira aqui e para de segurar unidades.
 * Se o PC da loja receber esse evento depois, ele também não separa nada (ver PDV).
 */
async function expirarNaoConfirmados(tx: Tx) {
	await tx`
		UPDATE pdv_pedido SET status = 'EXPIRADO', motivo = 'A loja não confirmou a tempo', atualizado_em = now()
		WHERE status = 'AGUARDANDO_CONFIRMACAO' AND criado_em < now() - make_interval(hours => ${PRAZO_CONFIRMACAO_HORAS})`;
}

const publico = (p: LinhaPedido): PedidoPublico => ({
	id: p.id,
	numero: p.numero,
	status: p.status,
	itens: p.itens,
	totalCentavos: p.total_centavos,
	nomeContato: mascararNome(p.nome_contato),
	telefoneContato: mascararTelefone(p.telefone_contato),
	validoAte: p.valido_ate?.toISOString() ?? null,
	motivo: p.motivo,
	criadoEm: p.criado_em.toISOString(),
});

class CloudPdv implements PdvClient {
	async listarCatalogo(): Promise<ProdutoCatalogo[]> {
		const db = sql();
		await expirarNaoConfirmados(db);
		const [produtos, demanda] = await Promise.all([
			db<LinhaProduto[]>`
				SELECT produto_id, sku, nome, categoria, grupo, preco_centavos, disponivel, componentes, promocao FROM pdv_produto WHERE visivel ORDER BY grupo, nome`,
			demandaPendente(db),
		]);
		return produtos.map((p) => ({
			produtoId: p.produto_id,
			sku: p.sku,
			nome: p.nome,
			categoria: p.categoria,
			grupo: p.grupo,
			precoCentavos: p.preco_centavos,
			disponivel: disponivelNoSite(p, demanda),
			promocao: promocaoVigente(p.promocao),
		}));
	}

	async listarEstoque(): Promise<EstoqueItem[]> {
		return (await this.listarCatalogo()).map(({ produtoId, disponivel, precoCentavos }) => ({ produtoId, disponivel, precoCentavos }));
	}

	async criarPedido(input: CriarPedidoInput, origem?: { ipHash?: string }): Promise<PedidoPublico> {
		const { nome, telefone, quantidades } = validarPedido(input);
		const ids = [...quantidades.keys()];
		const ipHash = origem?.ipHash ?? null;
		return sql().begin(async (tx) => {
			// Uma linha só trava todas as criações de pedido e os envios do PDV: sem corrida pela última unidade
			await tx`SELECT 1 FROM pdv_sync WHERE id = 1 FOR UPDATE`;
			await expirarNaoConfirmados(tx);

			// Quem já tem pedidos em aberto não segura mais estoque até pagar ou a loja confirmar
			const [abertos] = await tx<{ por_telefone: number; por_ip: number }[]>`
				SELECT
					count(*) FILTER (WHERE telefone_contato = ${telefone})::int AS por_telefone,
					count(*) FILTER (WHERE ${ipHash}::text IS NOT NULL AND ip_hash = ${ipHash})::int AS por_ip
				FROM pdv_pedido WHERE status IN ('AGUARDANDO_CONFIRMACAO', 'PAGAMENTO_PENDENTE')`;
			if (abertos.por_telefone >= MAX_ABERTOS_POR_TELEFONE || abertos.por_ip >= MAX_ABERTOS_POR_IP) {
				throw new PdvError(
					'LIMITE_PEDIDOS',
					'Você já tem pedidos em aberto. Conclui o pagamento (ou espera a loja confirmar) antes de fazer outro.',
					429,
				);
			}
			const produtos = await tx<LinhaProduto[]>`
				SELECT produto_id, sku, nome, categoria, grupo, preco_centavos, disponivel, componentes FROM pdv_produto WHERE visivel AND produto_id = ANY(${ids})`;
			const porId = new Map(produtos.map((p) => [p.produto_id, p]));
			const fora = ids.filter((id) => !porId.has(id));
			if (fora.length) throw new PdvError('ITEM_INVALIDO', 'Um item da sacola saiu da loja. Atualize a página.', 409, fora.map((produtoId) => ({ produtoId, disponivel: 0 })));

			// Confere o pedido como se ele já estivesse na demanda: um kit e um componente avulso no
			// mesmo pedido (ou dois kits com componente em comum) disputam as mesmas unidades
			const demanda = await demandaPendente(tx);
			const livre = (id: string) => disponivelNoSite(porId.get(id)!, demanda);
			const faltando: { produtoId: string; disponivel: number }[] = [];
			for (const [id, qtd] of quantidades) {
				const antes = livre(id);
				if (qtd > MAX_QUANTIDADE_POR_ITEM || qtd > antes) {
					faltando.push({ produtoId: id, disponivel: Math.min(antes, MAX_QUANTIDADE_POR_ITEM) });
					continue;
				}
				const comps = porId.get(id)!.componentes;
				if (comps?.length) for (const c of comps) demanda.set(c.produtoId, (demanda.get(c.produtoId) ?? 0) + c.quantidade * qtd);
				else demanda.set(id, (demanda.get(id) ?? 0) + qtd);
			}
			if (faltando.length) {
				const nomes = faltando.map(({ produtoId }) => porId.get(produtoId)!.nome).join(', ');
				throw new PdvError('ESTOQUE_INSUFICIENTE', `Sem estoque suficiente pra: ${nomes}.`, 409, faltando);
			}

			// O preço vem sempre do PDV (a última foto), nunca do navegador
			const itens = [...quantidades].map(([produtoId, quantidade]) => {
				const p = porId.get(produtoId)!;
				return { produtoId, descricao: p.nome, quantidade, precoUnitarioCentavos: p.preco_centavos, totalCentavos: p.preco_centavos * quantidade };
			});
			const id = randomUUID();
			const total = itens.reduce((s, i) => s + i.totalCentavos, 0);
			const [pedido] = await tx<LinhaPedido[]>`
				INSERT INTO pdv_pedido (id, status, itens, total_centavos, nome_contato, telefone_contato, ip_hash)
				VALUES (${id}, 'AGUARDANDO_CONFIRMACAO', ${tx.json(itens)}, ${total}, ${nome}, ${telefone}, ${ipHash})
				RETURNING *`;
			const [evento] = await tx<{ id: string }[]>`
				INSERT INTO pdv_evento (tipo, pedido_id, payload)
				VALUES ('PEDIDO_CRIADO', ${id}, ${tx.json({
					numero: pedido.numero,
					itens: itens.map(({ produtoId, descricao, quantidade, precoUnitarioCentavos }) => ({ produtoId, descricao, quantidade, precoUnitarioCentavos })),
					nomeContato: nome,
					telefoneContato: telefone,
				})})
				RETURNING id`;
			await tx`UPDATE pdv_pedido SET evento_id = ${evento.id} WHERE id = ${id}`;
			return publico(pedido);
		});
	}

	async buscarPedido(id: string): Promise<PedidoPublico> {
		if (!UUID.test(id)) throw new PdvError('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404);
		await expirarNaoConfirmados(sql());
		const [p] = await sql()<LinhaPedido[]>`SELECT * FROM pdv_pedido WHERE id = ${id}`;
		if (!p) throw new PdvError('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404);
		return publico(p);
	}

	async confirmarPagamento(): Promise<PedidoPublico> {
		throw new PdvError('OPERACAO_NO_PDV', 'O pagamento é registrado no PDV da loja.', 405);
	}

	async cancelarPedido(): Promise<PedidoPublico> {
		throw new PdvError('OPERACAO_NO_PDV', 'O cancelamento é feito no PDV da loja.', 405);
	}
}

export const cloudPdv: PdvClient = new CloudPdv();

/** Quando o PC da loja falou com o site pela última vez. */
export async function ultimoContatoDaLoja(): Promise<Date | null> {
	const [s] = await sql()<{ ultimo_contato_em: Date | null }[]>`SELECT ultimo_contato_em FROM pdv_sync WHERE id = 1`;
	return s?.ultimo_contato_em ?? null;
}

// ─── Lado do PDV (rotas /api/pdv-sync/*) ────────────────

async function atualizarPedido(tx: Tx, p: StatusPedidoSite) {
	await tx`
		UPDATE pdv_pedido SET status = ${p.status}, numero_pdv = ${p.numeroPdv}, valido_ate = ${p.validoAte}, motivo = ${p.motivo ?? null}, atualizado_em = now()
		WHERE id = ${p.pedidoId}`;
}

/** Recebe a foto (completa ou parcial) do estoque e as mudanças de pedidos feitas na loja. */
export async function receberEstoque(envio: EnvioEstoque) {
	return sql().begin(async (tx) => {
		const [estado] = await tx<{ pdv_seq: string; ultimo_gerado_em: Date | null }[]>`
			SELECT pdv_seq, ultimo_gerado_em FROM pdv_sync WHERE id = 1 FOR UPDATE`;
		const geradoEm = new Date(envio.geradoEm);
		if (Number.isNaN(geradoEm.getTime())) return { aceito: false };
		// Envio mais velho que o último aceito é ignorado: cobre envio atrasado e requisição capturada e
		// reenviada. Foto completa de um PDV restaurado de backup passa, porque é gerada na hora.
		if (estado.ultimo_gerado_em && geradoEm <= estado.ultimo_gerado_em) return { aceito: false };
		if (!envio.completo && envio.pdvSeq <= Number(estado.pdv_seq)) return { aceito: false };

		// Com `promocao` no envio, grava (null limpa o selo). Sem o campo (PDV antigo), mantém o que estava salvo.
		const comPromocao = envio.itens.filter((i) => i.promocao !== undefined);
		const semPromocao = envio.itens.filter((i) => i.promocao === undefined);
		const json = (v: unknown) => (v ? (tx.json(v as postgres.JSONValue) as unknown as string) : null);
		const linha = (i: EnvioEstoque['itens'][number]) => ({
			produto_id: i.produtoId, sku: i.sku, nome: i.nome, categoria: i.categoria, grupo: i.grupo,
			preco_centavos: i.precoCentavos, disponivel: i.disponivel, visivel: i.noCatalogo, atualizado_em: i.atualizadoEm,
			componentes: json(i.componentes),
		});
		if (comPromocao.length) {
			await tx`
				INSERT INTO pdv_produto ${tx(comPromocao.map((i) => ({ ...linha(i), promocao: json(i.promocao) })))}
				ON CONFLICT (produto_id) DO UPDATE SET
					sku = excluded.sku, nome = excluded.nome, categoria = excluded.categoria, grupo = excluded.grupo,
					preco_centavos = excluded.preco_centavos, disponivel = excluded.disponivel, visivel = excluded.visivel,
					atualizado_em = excluded.atualizado_em, componentes = excluded.componentes, promocao = excluded.promocao,
					recebido_em = now()`;
		}
		if (semPromocao.length) {
			await tx`
				INSERT INTO pdv_produto ${tx(semPromocao.map(linha))}
				ON CONFLICT (produto_id) DO UPDATE SET
					sku = excluded.sku, nome = excluded.nome, categoria = excluded.categoria, grupo = excluded.grupo,
					preco_centavos = excluded.preco_centavos, disponivel = excluded.disponivel, visivel = excluded.visivel,
					atualizado_em = excluded.atualizado_em, componentes = excluded.componentes, recebido_em = now()`;
		}
		if (envio.completo) {
			const ids = envio.itens.map((i) => i.produtoId);
			await tx`UPDATE pdv_produto SET visivel = false WHERE visivel AND NOT (produto_id = ANY(${ids}))`;
		}
		for (const p of envio.pedidos) await atualizarPedido(tx, p);
		await tx`
			UPDATE pdv_sync SET pdv_seq = ${envio.pdvSeq}, eventos_aplicados_ate = ${envio.eventosAplicadosAte}, ultimo_contato_em = now(),
				ultimo_gerado_em = ${geradoEm}
				${envio.completo ? tx`, ultima_foto_completa_em = now()` : tx``}
			WHERE id = 1`;
		return { aceito: true };
	});
}

/** Eventos depois do cursor do PDV, em ordem. Inclui os já confirmados: reaplicar não tem efeito no PDV. */
export async function listarEventos(depois: number, limite: number) {
	const db = sql();
	const eventos = await db<{ id: string; tipo: string; pedido_id: string; payload: Record<string, unknown>; criado_em: Date }[]>`
		SELECT id, tipo, pedido_id, payload, criado_em FROM pdv_evento WHERE id > ${depois} ORDER BY id LIMIT ${limite}`;
	await db`UPDATE pdv_sync SET ultimo_contato_em = now() WHERE id = 1`;
	return eventos.map((e) => ({ id: Number(e.id), tipo: e.tipo, pedidoId: e.pedido_id, criadoEm: e.criado_em.toISOString(), payload: e.payload }));
}

/** O PDV aplicou (ou recusou) os eventos: atualiza o status que o cliente vê e limpa dados de contato antigos. */
export async function confirmarEventos(resultados: ResultadoEvento[]) {
	await sql().begin(async (tx) => {
		for (const r of resultados) {
			const [antes] = await tx<{ aplicado_em: Date | null }[]>`SELECT aplicado_em FROM pdv_evento WHERE id = ${r.eventoId} FOR UPDATE`;
			if (!antes) continue;
			await tx`UPDATE pdv_evento SET aplicado_em = coalesce(aplicado_em, now()), resultado = ${tx.json(r as unknown as postgres.JSONValue)} WHERE id = ${r.eventoId}`;
			if (r.pedido) await atualizarPedido(tx, r.pedido);
			// Recusa sem pedido (evento ilegível) só vale na primeira vez: um reenvio antigo não desfaz um pedido confirmado
			else if (r.status === 'RECUSADO' && !antes.aplicado_em) {
				await tx`
					UPDATE pdv_pedido SET status = 'RECUSADO', motivo = ${r.motivo}, atualizado_em = now()
					WHERE id = (SELECT pedido_id FROM pdv_evento WHERE id = ${r.eventoId})`;
			}
		}
		// LGPD: um dia depois de a loja receber, o site guarda só primeiro nome e 4 dígitos
		await tx`
			UPDATE pdv_evento SET payload = payload - 'nomeContato' - 'telefoneContato'
			WHERE aplicado_em < now() - interval '1 day' AND payload ? 'telefoneContato'`;
		await tx`
			UPDATE pdv_pedido SET nome_contato = split_part(nome_contato, ' ', 1), telefone_contato = right(telefone_contato, 4), contato_mascarado = true
			WHERE NOT contato_mascarado AND status NOT IN ('AGUARDANDO_CONFIRMACAO', 'PAGAMENTO_PENDENTE')
				AND atualizado_em < now() - interval '1 day'`;
		await tx`UPDATE pdv_sync SET ultimo_contato_em = now() WHERE id = 1`;
	});
}
