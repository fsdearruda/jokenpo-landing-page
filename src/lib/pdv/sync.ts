/**
 * Contrato da sincronização com o site (regras puras, sem banco e sem dependências).
 *
 * O PC da loja nunca recebe conexão de fora: ele chama o site de tempos em tempos,
 * envia o estoque disponível e busca os pedidos feitos lá. Ver docs/API-SITE.md.
 *
 * FONTE ÚNICA: este arquivo é copiado byte a byte para o site (src/lib/pdv/sync.ts,
 * com `pnpm sync:contract`), e o CI do site falha se a cópia for diferente. Por isso
 * ele só importa `node:crypto`. Exemplos de mensagens em contract-fixtures/.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Prazo para o cliente pagar depois que a loja confirma o estoque. */
export const PRAZO_PAGAMENTO_HORAS = 48;
/** O site expira pedido não confirmado nesse prazo; o PDV não separa estoque para evento mais velho que isso. */
export const PRAZO_CONFIRMACAO_HORAS = 72;
/** Preço do site aceito se for o atual ou um do histórico desse período (a foto do site pode estar velha). */
export const PRECO_HISTORICO_DIAS = 7;
/** Requisição assinada vale por 5 minutos (evita reenvio de uma requisição capturada). */
export const ASSINATURA_VALIDADE_MS = 5 * 60_000;
/** Limite por item num pedido do site (o site também confere). */
export const MAX_QUANTIDADE_POR_ITEM = 5;
export const MAX_ITENS_POR_PEDIDO = 20;

// ─── Tipos do protocolo ─────────────────────────────────

export interface ItemEventoPedido {
  produtoId: string;
  descricao: string;
  quantidade: number;
  precoUnitarioCentavos: number;
}

export interface EventoPedidoCriado {
  id: number;
  tipo: "PEDIDO_CRIADO";
  pedidoId: string;
  criadoEm: string;
  payload: {
    numero: number;
    itens: ItemEventoPedido[];
    nomeContato: string;
    telefoneContato: string;
  };
}

export type EventoSite = EventoPedidoCriado;

export type ResultadoEvento =
  | { eventoId: number; status: "APLICADO"; pedido: StatusPedidoSite }
  // pedido ausente = evento em formato inválido (nada foi criado no PDV)
  | { eventoId: number; status: "RECUSADO"; motivo: string; pedido?: StatusPedidoSite; detalhes?: { produtoId: string; disponivel: number }[] };

/** Situação de um pedido do site, enviada junto com o estoque e nas confirmações. */
export interface StatusPedidoSite {
  pedidoId: string;      // id do pedido no site (Pedido.chaveExterna)
  numeroPdv: number;
  status: StatusSite;
  validoAte: string | null;
  motivo?: string | null;
}

export type StatusSite = "PAGAMENTO_PENDENTE" | "PAGO" | "ENTREGUE" | "RECUSADO" | "CANCELADO" | "EXPIRADO";
export const STATUS_SITE: readonly StatusSite[] = ["PAGAMENTO_PENDENTE", "PAGO", "ENTREGUE", "RECUSADO", "CANCELADO", "EXPIRADO"];

/** Status do pedido no PDV (enum StatusPedido do Prisma; repetido aqui para o contrato não depender do Prisma). */
export type StatusPedidoPdv = "ABERTO" | "CONFIRMADO" | "PRONTO" | "ENTREGUE" | "CANCELADO" | "EXPIRADO" | "RECUSADO";

/** Componente de um KIT, com o disponível de cada um. */
export interface ComponenteKit {
  produtoId: string;
  quantidade: number;
  disponivel: number;
}

export interface ItemFoto {
  produtoId: string;
  sku: string | null;
  nome: string;
  categoria: string | null; // categoria do PDV
  grupo: string | null;     // categoria "pai" (ou a própria, se não tiver pai): vira a seção da vitrine
  precoCentavos: number;
  disponivel: number;
  noCatalogo: boolean; // false = sai da vitrine (desmarcado, inativo, excluído ou fora do período de venda)
  atualizadoEm: string;
  /** Só em KIT: o site desconta os pedidos pendentes de cada componente, como o PDV faz. */
  componentes?: ComponenteKit[];
  /**
   * Promoção vigente no canal site (precoCentavos já é o preço promocional). null = sem promoção:
   * o site limpa o selo. Ausente (PDV antigo) = o site mantém o que tinha até a próxima foto.
   */
  promocao?: PromocaoFoto | null;
  /**
   * Conteúdo da vitrine, editado no PDV. Ausente (PDV antigo) = o site mantém o que tinha.
   * Vem sempre inteiro: cada campo vazio é null (ou lista vazia), nunca ausente.
   */
  conteudo?: ConteudoFoto;
}

/** O que o site mostra além de nome e preço: tudo vem do cadastro do PDV. */
export interface ConteudoFoto {
  nomeSite: string | null;    // nome de vitrine; null = usa `nome`
  descricao: string | null;
  slug: string | null;        // endereço da página do produto (/loja/<slug>)
  destaque: boolean;          // aparece primeiro na seção
  fotos: string[];            // URLs públicas (Vercel Blob), na ordem; a 1ª é a capa
  ordemGrupo: number | null;  // ordem da seção (Categoria.ordem do grupo)
  /** Só em carta avulsa: dados para os filtros do site. Ausente (PDV antigo) = null. */
  carta?: CartaFoto | null;
}

/** Carta avulsa: o que diferencia uma da outra na vitrine. Sem imagem das APIs de cartas (licença). */
export interface CartaFoto {
  jogo: string;            // MAGIC, POKEMON, YUGIOH, ONE_PIECE, LORCANA
  nomeCarta: string;
  colecao: string;         // código, ex.: "OP01"
  colecaoNome: string | null;
  numero: string | null;
  raridade: string | null;
  condicao: string;        // NM, SP, MP, HP, DMG
  idioma: string;          // PT, EN, JP...
  acabamento: string;      // normal, foil...
}

/** Selo de promoção de um produto no site: preço antigo riscado, nome e até quando vale. */
export interface PromocaoFoto {
  id: string;
  nome: string;                  // até NOME_PROMOCAO_SITE_MAX caracteres
  precoOriginalCentavos: number; // preço cadastrado, mostrado riscado (maior que precoCentavos)
  terminaEm: string;             // ISO 8601
}

export interface EnvioEstoque {
  pdvSeq: number;
  completo: boolean;
  eventosAplicadosAte: number;
  geradoEm: string;
  itens: ItemFoto[];
  pedidos: StatusPedidoSite[];
  /** Regras da loja para o site. Ausente (PDV antigo) = o site mantém o que tinha. */
  loja?: LojaFoto;
}

export interface LojaFoto {
  /** Acréscimo no preço para pagar no cartão, em centésimos de % (500 = 5%). 0 = sem acréscimo. */
  acrescimoCartaoBp: number;
}

/** Foto de produto enviada pelo PDV (POST /api/pdv-sync/foto). O site guarda e devolve a URL pública. */
export interface EnvioFoto {
  produtoId: string;
  fotoId: string;
  tipo: "image/webp" | "image/jpeg" | "image/png";
  dados: string; // base64
}

/** Limites de conteúdo (o PDV também confere ao salvar). */
export const MAX_FOTOS_PRODUTO = 5;
export const MAX_FOTO_BYTES = 2_500_000; // depois de virar base64 cabe no corpo de 4,5 MB da Vercel
export const MAX_DESCRICAO_SITE = 1_000;
export const MAX_NOME_SITE = 80;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ─── Assinatura ─────────────────────────────────────────

const base = (ts: string, metodo: string, caminho: string, corpo: string) => `${ts}\n${metodo.toUpperCase()}\n${caminho}\n${corpo}`;

export function assinar(segredo: string, ts: string, metodo: string, caminho: string, corpo: string): string {
  return createHmac("sha256", segredo).update(base(ts, metodo, caminho, corpo)).digest("base64url");
}

export function assinaturaValida(segredo: string, ts: string, metodo: string, caminho: string, corpo: string, assinatura: string, agora = Date.now()): boolean {
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(agora - t) > ASSINATURA_VALIDADE_MS) return false;
  const esperada = Buffer.from(assinar(segredo, ts, metodo, caminho, corpo));
  const recebida = Buffer.from(assinatura);
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

// ─── Eventos ────────────────────────────────────────────

const texto = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inteiro = (v: unknown, min: number, max: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null);

/** Confere um evento vindo do site. Devolve null se o formato for inválido (o evento é recusado, não trava a fila). */
export function lerEvento(bruto: unknown): EventoSite | null {
  if (!bruto || typeof bruto !== "object") return null;
  const e = bruto as Record<string, unknown>;
  const id = inteiro(e.id, 1, Number.MAX_SAFE_INTEGER);
  const pedidoId = texto(e.pedidoId, 64);
  const criadoEm = texto(e.criadoEm, 40);
  if (!id || !pedidoId || !UUID.test(pedidoId) || !criadoEm || Number.isNaN(Date.parse(criadoEm)) || e.tipo !== "PEDIDO_CRIADO") return null;
  const p = e.payload as Record<string, unknown> | undefined;
  if (!p || !Array.isArray(p.itens) || p.itens.length === 0 || p.itens.length > MAX_ITENS_POR_PEDIDO) return null;
  const numero = inteiro(p.numero, 1, Number.MAX_SAFE_INTEGER);
  const nomeContato = texto(p.nomeContato, 80);
  const telefoneContato = texto(p.telefoneContato, 20);
  if (!numero || !nomeContato || !telefoneContato) return null;
  const itens: ItemEventoPedido[] = [];
  for (const bi of p.itens as Record<string, unknown>[]) {
    const produtoId = texto(bi?.produtoId, 64);
    const descricao = texto(bi?.descricao, 200);
    const quantidade = inteiro(bi?.quantidade, 1, MAX_QUANTIDADE_POR_ITEM);
    const preco = inteiro(bi?.precoUnitarioCentavos, 0, 100_000_000);
    if (!produtoId || !descricao || !quantidade || preco === null) return null;
    itens.push({ produtoId, descricao, quantidade, precoUnitarioCentavos: preco });
  }
  return { id, tipo: "PEDIDO_CRIADO", pedidoId, criadoEm, payload: { numero, itens: juntarItens(itens), nomeContato, telefoneContato } };
}

/** Itens repetidos do mesmo produto viram uma linha só (com o preço da primeira). */
export function juntarItens(itens: ItemEventoPedido[]): ItemEventoPedido[] {
  const m = new Map<string, ItemEventoPedido>();
  for (const i of itens) {
    const j = m.get(i.produtoId);
    if (j) j.quantidade += i.quantidade;
    else m.set(i.produtoId, { ...i });
  }
  return [...m.values()];
}

// ─── Promoção ───────────────────────────────────────────

/** O selo do site é pequeno. */
export const NOME_PROMOCAO_SITE_MAX = 30;

/**
 * Confere o campo `promocao` de um produto do envio de estoque. Devolve a promoção válida ou null
 * (sem promoção, ou formato inválido: o produto aparece só com precoCentavos, sem selo).
 * Regras: nome com 1 a 30 caracteres, precoOriginalCentavos inteiro maior que precoCentavos, terminaEm data válida.
 */
export function lerPromocaoFoto(bruto: unknown, precoCentavos: number): PromocaoFoto | null {
  if (!bruto || typeof bruto !== "object") return null;
  const p = bruto as Record<string, unknown>;
  const id = texto(p.id, 64);
  const nome = texto(p.nome, NOME_PROMOCAO_SITE_MAX);
  const original = inteiro(p.precoOriginalCentavos, 1, 100_000_000);
  const terminaEm = texto(p.terminaEm, 40);
  if (!id || !nome || original === null || !Number.isInteger(precoCentavos) || original <= precoCentavos) return null;
  if (!terminaEm || Number.isNaN(Date.parse(terminaEm))) return null;
  return { id, nome, precoOriginalCentavos: original, terminaEm };
}

// ─── Validação do que o PDV manda (usada pelo site) ─────

const textoOpcional = (v: unknown, max: number) => (v === null || v === undefined ? null : typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined);
const textoExato = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const inteiroMin = (v: unknown, min = 0): v is number => Number.isInteger(v) && (v as number) >= min;

/** Confere a situação de um pedido enviada pelo PDV. null = formato inválido. */
export function lerStatusPedido(v: unknown): StatusPedidoSite | null {
  const p = v as Record<string, unknown> | null;
  if (!p || typeof p.pedidoId !== "string" || !/^[0-9a-f-]{36}$/i.test(p.pedidoId) || !inteiroMin(p.numeroPdv, 1) || !STATUS_SITE.includes(p.status as StatusSite)) return null;
  const validoAte = textoOpcional(p.validoAte, 40);
  const motivo = textoOpcional(p.motivo, 300);
  if (validoAte === undefined || motivo === undefined) return null;
  return { pedidoId: p.pedidoId, numeroPdv: p.numeroPdv, status: p.status as StatusSite, validoAte, motivo };
}

/** Confere um envio de estoque (POST /api/pdv-sync/estoque). null = recusa o envio inteiro. */
export function lerEnvioEstoque(v: unknown): EnvioEstoque | null {
  const e = v as Record<string, unknown> | null;
  if (!e || !inteiroMin(e.pdvSeq, 1) || typeof e.completo !== "boolean" || !inteiroMin(e.eventosAplicadosAte) || !textoExato(e.geradoEm, 40)) return null;
  if (!Array.isArray(e.itens) || e.itens.length > 20_000 || !Array.isArray(e.pedidos) || e.pedidos.length > 1_000) return null;
  const itens: ItemFoto[] = [];
  for (const raw of e.itens as Record<string, unknown>[]) {
    const sku = textoOpcional(raw?.sku, 80);
    const categoria = textoOpcional(raw?.categoria, 120);
    const grupo = textoOpcional(raw?.grupo, 120);
    if (
      !textoExato(raw?.produtoId, 64) || !textoExato(raw.nome, 200) || !inteiroMin(raw.precoCentavos) || !inteiroMin(raw.disponivel) ||
      typeof raw.noCatalogo !== "boolean" || !textoExato(raw.atualizadoEm, 40) ||
      sku === undefined || categoria === undefined || grupo === undefined
    ) return null;
    let componentes: ComponenteKit[] | undefined;
    if (raw.componentes !== undefined) {
      if (!Array.isArray(raw.componentes) || raw.componentes.length > 50) return null;
      componentes = [];
      for (const c of raw.componentes as Record<string, unknown>[]) {
        if (!textoExato(c?.produtoId, 64) || !inteiroMin(c.quantidade, 1) || !inteiroMin(c.disponivel)) return null;
        componentes.push({ produtoId: c.produtoId, quantidade: c.quantidade, disponivel: c.disponivel });
      }
    }
    itens.push({
      produtoId: raw.produtoId, sku, nome: raw.nome, categoria, grupo, precoCentavos: raw.precoCentavos,
      disponivel: raw.disponivel, noCatalogo: raw.noCatalogo, atualizadoEm: raw.atualizadoEm,
      ...(componentes ? { componentes } : {}),
      // Ausente fica ausente (o site mantém o selo salvo); presente e inválida vira null (sem selo)
      ...(raw.promocao !== undefined ? { promocao: lerPromocaoFoto(raw.promocao, raw.precoCentavos) } : {}),
      // Ausente fica ausente; presente e inválido também fica ausente (o site mantém o conteúdo salvo)
      ...(raw.conteudo !== undefined && lerConteudoFoto(raw.conteudo) ? { conteudo: lerConteudoFoto(raw.conteudo)! } : {}),
    });
  }
  const pedidos: StatusPedidoSite[] = [];
  for (const raw of e.pedidos) {
    const p = lerStatusPedido(raw);
    if (!p) return null;
    pedidos.push(p);
  }
  let loja: LojaFoto | undefined;
  if (e.loja !== undefined) {
    const l = e.loja as Record<string, unknown> | null;
    const acrescimo = inteiro(l?.acrescimoCartaoBp, 0, 5_000);
    if (acrescimo === null) return null;
    loja = { acrescimoCartaoBp: acrescimo };
  }
  return { pdvSeq: e.pdvSeq, completo: e.completo, eventosAplicadosAte: e.eventosAplicadosAte, geradoEm: e.geradoEm, itens, pedidos, ...(loja ? { loja } : {}) };
}

/** Confere as confirmações de eventos (POST /api/pdv-sync/eventos/ack). null = recusa o lote. */
export function lerResultados(v: unknown): ResultadoEvento[] | null {
  const r = (v as { resultados?: unknown } | null)?.resultados;
  if (!Array.isArray(r) || r.length > 500) return null;
  const out: ResultadoEvento[] = [];
  for (const raw of r as Record<string, unknown>[]) {
    if (!inteiroMin(raw?.eventoId, 1)) return null;
    const pedido = raw.pedido === undefined || raw.pedido === null ? undefined : lerStatusPedido(raw.pedido);
    if (pedido === null) return null;
    if (raw.status === "APLICADO" && pedido) out.push({ eventoId: raw.eventoId, status: "APLICADO", pedido });
    else if (raw.status === "RECUSADO" && textoExato(raw.motivo, 300)) out.push({ eventoId: raw.eventoId, status: "RECUSADO", motivo: raw.motivo, pedido });
    else return null;
  }
  return out;
}

/** Confere o campo `conteudo`. Inválido vira null (o site mantém o que tinha, sem travar o envio). */
export function lerConteudoFoto(bruto: unknown): ConteudoFoto | null {
  if (!bruto || typeof bruto !== "object") return null;
  const c = bruto as Record<string, unknown>;
  const nomeSite = textoOpcional(c.nomeSite, MAX_NOME_SITE);
  const descricao = textoOpcional(c.descricao, MAX_DESCRICAO_SITE);
  const slug = textoOpcional(c.slug, 120);
  const ordemGrupo = c.ordemGrupo === null || c.ordemGrupo === undefined ? null : inteiro(c.ordemGrupo, 0, 1_000_000);
  if (nomeSite === undefined || descricao === undefined || slug === undefined || (slug !== null && !SLUG.test(slug))) return null;
  if (typeof c.destaque !== "boolean" || !Array.isArray(c.fotos) || c.fotos.length > MAX_FOTOS_PRODUTO) return null;
  const fotos: string[] = [];
  for (const f of c.fotos) {
    if (typeof f !== "string" || f.length > 500 || !f.startsWith("https://")) return null;
    fotos.push(f);
  }
  if (c.ordemGrupo !== null && c.ordemGrupo !== undefined && ordemGrupo === null) return null;
  const carta = c.carta === undefined || c.carta === null ? null : lerCartaFoto(c.carta);
  if (carta === undefined) return null;
  return { nomeSite, descricao, slug, destaque: c.destaque, fotos, ordemGrupo, ...(c.carta !== undefined ? { carta } : {}) };
}

/** undefined = inválida (recusa o conteúdo inteiro). */
function lerCartaFoto(bruto: unknown): CartaFoto | undefined {
  const c = bruto as Record<string, unknown> | null;
  if (!c || typeof c !== "object") return undefined;
  const curto = (v: unknown) => (textoExato(v, 40) ? v : undefined);
  const jogo = curto(c.jogo), colecao = curto(c.colecao), condicao = curto(c.condicao), idioma = curto(c.idioma), acabamento = curto(c.acabamento);
  const nomeCarta = textoExato(c.nomeCarta, 200) ? c.nomeCarta : undefined;
  const colecaoNome = textoOpcional(c.colecaoNome, 120), numero = textoOpcional(c.numero, 40), raridade = textoOpcional(c.raridade, 80);
  if (!jogo || !colecao || !condicao || !idioma || !acabamento || !nomeCarta || colecaoNome === undefined || numero === undefined || raridade === undefined) return undefined;
  return { jogo, nomeCarta, colecao, colecaoNome, numero, raridade, condicao, idioma, acabamento };
}

/** Confere o envio de uma foto. null = recusa. */
export function lerEnvioFoto(v: unknown): EnvioFoto | null {
  const f = v as Record<string, unknown> | null;
  if (!f || !textoExato(f.produtoId, 64) || !textoExato(f.fotoId, 64) || !/^[A-Za-z0-9_-]+$/.test(f.fotoId) || !/^[A-Za-z0-9_-]+$/.test(f.produtoId)) return null;
  if (f.tipo !== "image/webp" && f.tipo !== "image/jpeg" && f.tipo !== "image/png") return null;
  if (typeof f.dados !== "string" || f.dados.length === 0 || f.dados.length > Math.ceil(MAX_FOTO_BYTES / 3) * 4) return null;
  return { produtoId: f.produtoId, fotoId: f.fotoId, tipo: f.tipo, dados: f.dados };
}

// ─── Estoque e prazos ───────────────────────────────────

/** Disponível para venda: estoque menos o que já está separado para pedidos. */
export const livre = (p: { estoque: number; estoqueReservado: number }) => Math.max(0, p.estoque - p.estoqueReservado);

/** Kit: quantos kits completos dá para montar com os componentes livres. */
export function disponivelKit(componentes: { quantidade: number; componente: { estoque: number; estoqueReservado: number; controlaEstoque: boolean } }[]): number {
  if (componentes.length === 0) return 0;
  const n = Math.min(...componentes.map((c) => (c.componente.controlaEstoque ? Math.floor(livre(c.componente) / Math.max(1, c.quantidade)) : Infinity)));
  return Number.isFinite(n) ? n : SEM_CONTROLE;
}

/** Produto sem controle de estoque aparece no site com esta quantidade (o limite por item segura o pedido). */
export const SEM_CONTROLE = 99;

export const prazoPagamento = (confirmadoEm: Date) => new Date(confirmadoEm.getTime() + PRAZO_PAGAMENTO_HORAS * 3_600_000);

/** Status do PDV → o que o site mostra. ABERTO = estoque separado, esperando o pagamento. */
export function statusParaSite(status: StatusPedidoPdv): StatusSite {
  switch (status) {
    case "ABERTO": case "PRONTO": return "PAGAMENTO_PENDENTE";
    case "CONFIRMADO": return "PAGO";
    case "ENTREGUE": return "ENTREGUE";
    case "RECUSADO": return "RECUSADO";
    case "EXPIRADO": return "EXPIRADO";
    case "CANCELADO": return "CANCELADO";
  }
}

/** Evento mais velho que o prazo de confirmação: o site já expirou o pedido, o PDV não separa nada. */
export const eventoVencido = (criadoEm: string, agora = new Date()) =>
  agora.getTime() - Date.parse(criadoEm) > PRAZO_CONFIRMACAO_HORAS * 3_600_000;

/** O preço que veio do site é um preço que o produto teve de verdade (atual ou no histórico recente)? */
export function precoConfere(precoSite: number, precoAtual: number, historico: number[]): boolean {
  return precoSite === precoAtual || historico.includes(precoSite);
}

/** URL do site: https sempre, exceto localhost (testes). */
export function urlSiteValida(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname));
  } catch {
    return false;
  }
}

/** Espera entre tentativas quando o site não responde: 15 s, 30 s, 1 min… até 5 min. */
export function esperaAposFalhas(falhas: number, baseMs = 15_000, maxMs = 5 * 60_000): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, falhas - 1));
}
