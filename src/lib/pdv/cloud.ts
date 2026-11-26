import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { sql } from '../db';
import { calcularDemanda, disponivelNoSite, expirouSemConfirmacao, lojaOffline, podeMudarStatus, promocaoVigente } from './estoque';
import { apagarFotos } from './fotos';
import type { CartaFoto, ComponenteKit, EnvioEstoque, PromocaoFoto, ResultadoEvento, StatusPedidoSite } from './sync';
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
	nome_site?: string | null;
	descricao?: string | null;
	slug?: string | null;
	destaque?: boolean;
	fotos?: string[];
	ordem_grupo?: number | null;
	carta?: CartaFoto | null;
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
				AND NOT (status = 'AGUARDANDO_CONFIRMACAO' AND criado_em < now() - make_interval(hours => ${PRAZO_CONFIRMACAO_HORAS}))
				AND evento_id > (SELECT eventos_aplicados_ate FROM pdv_sync WHERE id = 1)`,
		tx<{ produto_id: string; componentes: ComponenteKit[] }[]>`SELECT produto_id, componentes FROM pdv_produto WHERE componentes IS NOT NULL`,
	]);
	return calcularDemanda(pedidos, new Map(kits.map((k) => [k.produto_id, k.componentes])));
}

/**
 * Pedido que a loja não confirmou em 72 h expira aqui e para de segurar unidades.
 * Se o PC da loja receber esse evento depois, ele também não separa nada (ver PDV).
 * As leituras públicas não gravam: `demandaPendente` e `publico` já tratam o pedido vencido como expirado,
 * e a faxina diária (`manutencao`) grava o status.
 */
async function expirarNaoConfirmados(tx: Tx) {
	await tx`
		UPDATE pdv_pedido SET status = 'EXPIRADO', motivo = 'A loja não confirmou a tempo', atualizado_em = now()
		WHERE status = 'AGUARDANDO_CONFIRMACAO' AND criado_em < now() - make_interval(hours => ${PRAZO_CONFIRMACAO_HORAS})`;
}

const COLUNAS_CATALOGO =
	'produto_id, sku, nome, categoria, grupo, preco_centavos, disponivel, componentes, promocao, nome_site, descricao, slug, destaque, fotos, ordem_grupo, carta';

const paraCatalogo = (p: LinhaProduto, demanda: Map<string, number>): ProdutoCatalogo => ({
	produtoId: p.produto_id,
	sku: p.sku,
	nome: p.nome,
	categoria: p.categoria,
	grupo: p.grupo,
	precoCentavos: p.preco_centavos,
	disponivel: disponivelNoSite(p, demanda),
	promocao: promocaoVigente(p.promocao),
	nomeSite: p.nome_site ?? null,
	descricao: p.descricao ?? null,
	slug: p.slug ?? null,
	destaque: p.destaque ?? false,
	fotos: p.fotos ?? [],
	ordemGrupo: p.ordem_grupo ?? null,
	carta: p.carta ?? null,
});

const publico = (p: LinhaPedido): PedidoPublico => {
	const vencido = expirouSemConfirmacao(p.status, p.criado_em, PRAZO_CONFIRMACAO_HORAS);
	return {
	id: p.id,
	numero: p.numero,
	status: vencido ? 'EXPIRADO' : p.status,
	itens: p.itens,
	totalCentavos: p.total_centavos,
	nomeContato: mascararNome(p.nome_contato),
	telefoneContato: mascararTelefone(p.telefone_contato),
	validoAte: p.valido_ate?.toISOString() ?? null,
	motivo: vencido ? 'A loja não confirmou a tempo' : p.motivo,
	criadoEm: p.criado_em.toISOString(),
	};
};

class CloudPdv implements PdvClient {
	async listarCatalogo(): Promise<ProdutoCatalogo[]> {
		const db = sql();
		const [produtos, demanda] = await Promise.all([
			db<LinhaProduto[]>`
				SELECT ${db.unsafe(COLUNAS_CATALOGO)} FROM pdv_produto WHERE visivel ORDER BY grupo, nome`,
			demandaPendente(db),
		]);
		return produtos.map((p) => paraCatalogo(p, demanda));
	}

	/** Produto visível pelo endereço da página dele (/loja/<slug>). */
	async buscarPorSlug(slug: string): Promise<ProdutoCatalogo | null> {
		const db = sql();
		const [linha] = await db<LinhaProduto[]>`SELECT ${db.unsafe(COLUNAS_CATALOGO)} FROM pdv_produto WHERE visivel AND slug = ${slug} LIMIT 1`;
		if (!linha) return null;
		return paraCatalogo(linha, await demandaPendente(db));
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
			const [sync] = await tx<{ ultimo_contato_em: Date | null; ultimo_estoque_em: Date | null }[]>`
				SELECT ultimo_contato_em, ultimo_estoque_em FROM pdv_sync WHERE id = 1 FOR UPDATE`;
			// A página pode estar em cache de antes da queda: confere aqui também
			if (lojaOffline({ vistaEm: sync?.ultimo_contato_em ?? null, estoqueEm: sync?.ultimo_estoque_em ?? null })) {
				throw new PdvError('LOJA_OFFLINE', 'O sistema da loja está sem conexão agora. Manda o pedido pelo WhatsApp que a gente separa.', 503);
			}
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
		const [p] = await sql()<LinhaPedido[]>`SELECT * FROM pdv_pedido WHERE id = ${id}`;
		if (!p) throw new PdvError('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404);
		return publico(p);
	}
}

export const cloudPdv: PdvClient = new CloudPdv();

/** Desconto no Pix definido no PDV (null = o PDV ainda não mandou: Pix e cartão com o mesmo preço). */
export async function descontoPixDaLoja(): Promise<number | null> {
	const [s] = await sql()<{ desconto_pix_bp: number | null }[]>`SELECT desconto_pix_bp FROM pdv_sync WHERE id = 1`;
	return s?.desconto_pix_bp ?? null;
}

/** Quando o PC da loja falou com o site pela última vez e quando o site aceitou o último estoque dele. */
export async function contatoDaLoja(): Promise<{ vistaEm: Date | null; estoqueEm: Date | null }> {
	const [s] = await sql()<{ ultimo_contato_em: Date | null; ultimo_estoque_em: Date | null }[]>`
		SELECT ultimo_contato_em, ultimo_estoque_em FROM pdv_sync WHERE id = 1`;
	return { vistaEm: s?.ultimo_contato_em ?? null, estoqueEm: s?.ultimo_estoque_em ?? null };
}

/** Estado da sincronização para a checagem de saúde (/api/pdv-sync/saude). */
export async function estadoDaSincronizacao() {
	const db = sql();
	const [s] = await db<
		{ ultimo_contato_em: Date | null; ultimo_estoque_em: Date | null; alerta_chave: string; pendentes: number; pendente_desde: Date | null }[]
	>`
		SELECT s.ultimo_contato_em, s.ultimo_estoque_em, s.alerta_chave, p.pendentes, p.pendente_desde
		FROM pdv_sync s,
			(SELECT count(*)::int AS pendentes, min(criado_em) AS pendente_desde FROM pdv_evento WHERE aplicado_em IS NULL) p
		WHERE s.id = 1`;
	return {
		vistaEm: s?.ultimo_contato_em ?? null,
		estoqueEm: s?.ultimo_estoque_em ?? null,
		pendentes: s?.pendentes ?? 0,
		pendenteDesde: s?.pendente_desde ?? null,
		alertaChave: s?.alerta_chave ?? '',
	};
}

/** Guarda os problemas já avisados por e-mail. */
export async function registrarAlerta(chave: string) {
	await sql()`UPDATE pdv_sync SET alerta_chave = ${chave} WHERE id = 1`;
}

// ─── Lado do PDV (rotas /api/pdv-sync/*) ────────────────

async function atualizarPedido(tx: Tx, p: StatusPedidoSite) {
	const [atual] = await tx<{ status: StatusPedido }[]>`SELECT status FROM pdv_pedido WHERE id = ${p.pedidoId} FOR UPDATE`;
	if (!atual || !podeMudarStatus(atual.status, p.status)) return;
	await tx`
		UPDATE pdv_pedido SET status = ${p.status}, numero_pdv = ${p.numeroPdv}, valido_ate = ${p.validoAte}, motivo = ${p.motivo ?? null}, atualizado_em = now()
		WHERE id = ${p.pedidoId}`;
}

/** Recebe a foto (completa ou parcial) do estoque e as mudanças de pedidos feitas na loja. */
export async function receberEstoque(envio: EnvioEstoque) {
	let fotosRemovidas: string[] = [];
	const resultado = await sql().begin(async (tx) => {
		const [estado] = await tx<{ pdv_seq: string; ultimo_gerado_em: Date | null }[]>`
			SELECT pdv_seq, ultimo_gerado_em FROM pdv_sync WHERE id = 1 FOR UPDATE`;
		const geradoEm = new Date(envio.geradoEm);
		if (Number.isNaN(geradoEm.getTime())) return { aceito: false };
		// Envio mais velho que o último aceito é ignorado: cobre envio atrasado e requisição capturada e
		// reenviada. Foto completa de um PDV restaurado de backup passa, porque é gerada na hora.
		if (estado.ultimo_gerado_em && geradoEm <= estado.ultimo_gerado_em) return { aceito: false };
		if (!envio.completo && envio.pdvSeq <= Number(estado.pdv_seq)) return { aceito: false };

		const json = (v: unknown) => (v ? (tx.json(v as postgres.JSONValue) as unknown as string) : null);
		await tx`
			INSERT INTO pdv_produto ${tx(envio.itens.map((i) => ({
				produto_id: i.produtoId, sku: i.sku, nome: i.nome, categoria: i.categoria, grupo: i.grupo,
				preco_centavos: i.precoCentavos, disponivel: i.disponivel, visivel: i.noCatalogo, atualizado_em: i.atualizadoEm,
				componentes: json(i.componentes),
			})))}
			ON CONFLICT (produto_id) DO UPDATE SET
				sku = excluded.sku, nome = excluded.nome, categoria = excluded.categoria, grupo = excluded.grupo,
				preco_centavos = excluded.preco_centavos, disponivel = excluded.disponivel, visivel = excluded.visivel,
				atualizado_em = excluded.atualizado_em, componentes = excluded.componentes, recebido_em = now()`;

		// Campos opcionais: presentes gravam (promocao null limpa o selo); ausentes (PDV antigo) mantêm o que estava salvo
		const comPromocao = envio.itens.filter((i) => i.promocao !== undefined).map((i) => ({ produto_id: i.produtoId, promocao: i.promocao ?? null }));
		if (comPromocao.length) {
			await tx`
				UPDATE pdv_produto p SET promocao = v.promocao
				FROM jsonb_to_recordset(${json(comPromocao)}::jsonb) AS v(produto_id text, promocao jsonb)
				WHERE p.produto_id = v.produto_id`;
		}
		const comConteudo = envio.itens.flatMap((i) => (i.conteudo ? [{ produto_id: i.produtoId, ...i.conteudo }] : []));
		if (comConteudo.length) {
			const antigas = await tx<{ fotos: string[] }[]>`
				SELECT fotos FROM pdv_produto WHERE produto_id = ANY(${comConteudo.map((c) => c.produto_id)})`;
			const novas = new Set(comConteudo.flatMap((c) => c.fotos));
			fotosRemovidas = antigas.flatMap((a) => a.fotos).filter((url) => !novas.has(url));
			await tx`
				UPDATE pdv_produto p SET nome_site = v."nomeSite", descricao = v.descricao, slug = v.slug, destaque = v.destaque,
					fotos = v.fotos, ordem_grupo = v."ordemGrupo", carta = v.carta
				FROM jsonb_to_recordset(${json(comConteudo)}::jsonb)
					AS v(produto_id text, "nomeSite" text, descricao text, slug text, destaque boolean, fotos jsonb, "ordemGrupo" integer, carta jsonb)
				WHERE p.produto_id = v.produto_id`;
		}
		// O preço do PDV é o do cartão; o site mostra o Pix com este desconto (PDV antigo não manda: fica como estava)
		if (envio.loja?.descontoPixBp !== undefined) await tx`UPDATE pdv_sync SET desconto_pix_bp = ${envio.loja.descontoPixBp} WHERE id = 1`;
		if (envio.completo) {
			const ids = envio.itens.map((i) => i.produtoId);
			await tx`UPDATE pdv_produto SET visivel = false WHERE visivel AND NOT (produto_id = ANY(${ids}))`;
		}
		for (const p of envio.pedidos) await atualizarPedido(tx, p);
		await tx`
			UPDATE pdv_sync SET pdv_seq = ${envio.pdvSeq}, eventos_aplicados_ate = ${envio.eventosAplicadosAte}, ultimo_contato_em = now(),
				ultimo_estoque_em = now(), ultimo_gerado_em = ${geradoEm}
				${envio.completo ? tx`, ultima_foto_completa_em = now()` : tx``}
			WHERE id = 1`;
		return { aceito: true };
	});
	// Foto que saiu do produto sai do Blob (depois do commit; falha aqui não afeta o envio)
	if (fotosRemovidas.length) await apagarFotos(fotosRemovidas);
	return resultado;
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
					WHERE id = (SELECT pedido_id FROM pdv_evento WHERE id = ${r.eventoId}) AND status = 'AGUARDANDO_CONFIRMACAO'`;
			}
		}
		await tx`UPDATE pdv_sync SET ultimo_contato_em = now() WHERE id = 1`;
	});
}

// ─── Faxina diária (Vercel Schedules `manutencao-pdv`) ────────────────

/**
 * Grava a expiração dos pedidos vencidos, mascara contatos antigos (LGPD) e limpa o limite por IP.
 * Antes rodava só quando o PC da loja mandava dados; agora roda todo dia, com ou sem a loja.
 * Devolve as fotos ainda usadas, para a faxina do Blob.
 */
export async function manutencao() {
	return sql().begin(async (tx) => {
		await expirarNaoConfirmados(tx);
		// LGPD: um dia depois de encerrado, o site guarda só primeiro nome e 4 dígitos
		const pedidos = await tx`
			UPDATE pdv_pedido SET nome_contato = split_part(nome_contato, ' ', 1), telefone_contato = right(telefone_contato, 4), contato_mascarado = true
			WHERE NOT contato_mascarado AND status NOT IN ('AGUARDANDO_CONFIRMACAO', 'PAGAMENTO_PENDENTE')
				AND atualizado_em < now() - interval '1 day'`;
		// Evento: depois que a loja recebeu, ou quando o pedido dele já foi mascarado acima (expirou sem a
		// loja ver). Roda depois dos pedidos para pegar os mascarados nesta mesma passada.
		const eventos = await tx`
			UPDATE pdv_evento e SET payload = payload - 'nomeContato' - 'telefoneContato'
			WHERE payload ? 'telefoneContato'
				AND (aplicado_em < now() - interval '1 day'
					OR EXISTS (SELECT 1 FROM pdv_pedido p WHERE p.id = e.pedido_id AND p.contato_mascarado))`;
		const limites = await tx`DELETE FROM pdv_limite_ip WHERE janela < now() - interval '1 day'`;
		const fotos = await tx<{ url: string }[]>`SELECT DISTINCT jsonb_array_elements_text(fotos) AS url FROM pdv_produto WHERE fotos IS NOT NULL`;
		return {
			contatosMascarados: pedidos.count,
			eventosLimpos: eventos.count,
			limitesApagados: limites.count,
			fotosEmUso: new Set(fotos.map((f) => f.url)),
		};
	});
}
