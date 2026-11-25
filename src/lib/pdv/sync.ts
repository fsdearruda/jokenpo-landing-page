/**
 * Contrato da sincronização com o PDV da loja.
 *
 * O PC da loja nunca recebe conexão: ele chama estas rotas de tempos em tempos.
 * Cópia de `src/lib/site-sync.ts` do repositório jokenpo-pdv; mude os dois juntos.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ASSINATURA_VALIDADE_MS = 5 * 60_000;

export type StatusSite = 'PAGAMENTO_PENDENTE' | 'PAGO' | 'ENTREGUE' | 'RECUSADO' | 'CANCELADO' | 'EXPIRADO';

export interface StatusPedidoSite {
	pedidoId: string;
	numeroPdv: number;
	status: StatusSite;
	validoAte: string | null;
	motivo?: string | null;
}

export interface ItemFoto {
	produtoId: string;
	sku: string | null;
	nome: string;
	categoria: string | null;
	grupo: string | null;
	precoCentavos: number;
	disponivel: number;
	noCatalogo: boolean;
	atualizadoEm: string;
	componentes?: ComponenteKit[];
}

export interface ComponenteKit {
	produtoId: string;
	quantidade: number;
	disponivel: number;
}

export interface EnvioEstoque {
	pdvSeq: number;
	completo: boolean;
	eventosAplicadosAte: number;
	geradoEm: string;
	itens: ItemFoto[];
	pedidos: StatusPedidoSite[];
}

export type ResultadoEvento =
	| { eventoId: number; status: 'APLICADO'; pedido: StatusPedidoSite }
	| { eventoId: number; status: 'RECUSADO'; motivo: string; pedido?: StatusPedidoSite };

const STATUS_SITE: StatusSite[] = ['PAGAMENTO_PENDENTE', 'PAGO', 'ENTREGUE', 'RECUSADO', 'CANCELADO', 'EXPIRADO'];

const base = (ts: string, metodo: string, caminho: string, corpo: string) => `${ts}\n${metodo.toUpperCase()}\n${caminho}\n${corpo}`;

export const assinar = (segredo: string, ts: string, metodo: string, caminho: string, corpo: string) =>
	createHmac('sha256', segredo).update(base(ts, metodo, caminho, corpo)).digest('base64url');

export function assinaturaValida(
	segredo: string,
	ts: string,
	metodo: string,
	caminho: string,
	corpo: string,
	assinatura: string,
	agora = Date.now(),
) {
	const t = Number(ts);
	if (!Number.isFinite(t) || Math.abs(agora - t) > ASSINATURA_VALIDADE_MS) return false;
	const esperada = Buffer.from(assinar(segredo, ts, metodo, caminho, corpo));
	const recebida = Buffer.from(assinatura);
	return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

// ─── Validação do que o PDV manda ───────────────────────

const isInt = (v: unknown, min = 0): v is number => Number.isInteger(v) && (v as number) >= min;
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const optText = (v: unknown, max: number) => (v === null || v === undefined ? null : isText(v, max) ? v : undefined);
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

export function lerStatusPedido(v: unknown): StatusPedidoSite | null {
	const p = v as Record<string, unknown> | null;
	if (!p || !isUuid(p.pedidoId) || !isInt(p.numeroPdv, 1) || !STATUS_SITE.includes(p.status as StatusSite)) return null;
	const validoAte = optText(p.validoAte, 40);
	const motivo = optText(p.motivo, 300);
	if (validoAte === undefined || motivo === undefined) return null;
	return { pedidoId: p.pedidoId, numeroPdv: p.numeroPdv, status: p.status as StatusSite, validoAte, motivo };
}

export function lerEnvioEstoque(v: unknown): EnvioEstoque | null {
	const e = v as Record<string, unknown> | null;
	if (!e || !isInt(e.pdvSeq, 1) || typeof e.completo !== 'boolean' || !isInt(e.eventosAplicadosAte) || !isText(e.geradoEm, 40)) return null;
	if (!Array.isArray(e.itens) || e.itens.length > 20_000 || !Array.isArray(e.pedidos) || e.pedidos.length > 1_000) return null;
	const itens: ItemFoto[] = [];
	for (const raw of e.itens as Record<string, unknown>[]) {
		const sku = optText(raw?.sku, 80);
		const categoria = optText(raw?.categoria, 120);
		const grupo = optText(raw?.grupo, 120);
		if (
			!isText(raw?.produtoId, 64) || !isText(raw.nome, 200) || !isInt(raw.precoCentavos) || !isInt(raw.disponivel) ||
			typeof raw.noCatalogo !== 'boolean' || !isText(raw.atualizadoEm, 40) ||
			sku === undefined || categoria === undefined || grupo === undefined
		) return null;
		let componentes: ComponenteKit[] | undefined;
		if (raw.componentes !== undefined) {
			if (!Array.isArray(raw.componentes) || raw.componentes.length > 50) return null;
			componentes = [];
			for (const c of raw.componentes as Record<string, unknown>[]) {
				if (!isText(c?.produtoId, 64) || !isInt(c.quantidade, 1) || !isInt(c.disponivel)) return null;
				componentes.push({ produtoId: c.produtoId, quantidade: c.quantidade, disponivel: c.disponivel });
			}
		}
		itens.push({
			produtoId: raw.produtoId, sku, nome: raw.nome, categoria, grupo, precoCentavos: raw.precoCentavos,
			disponivel: raw.disponivel, noCatalogo: raw.noCatalogo, atualizadoEm: raw.atualizadoEm,
			...(componentes ? { componentes } : {}),
		});
	}
	const pedidos: StatusPedidoSite[] = [];
	for (const raw of e.pedidos) {
		const p = lerStatusPedido(raw);
		if (!p) return null;
		pedidos.push(p);
	}
	return { pdvSeq: e.pdvSeq, completo: e.completo, eventosAplicadosAte: e.eventosAplicadosAte, geradoEm: e.geradoEm, itens, pedidos };
}

export function lerResultados(v: unknown): ResultadoEvento[] | null {
	const r = (v as { resultados?: unknown } | null)?.resultados;
	if (!Array.isArray(r) || r.length > 500) return null;
	const out: ResultadoEvento[] = [];
	for (const raw of r as Record<string, unknown>[]) {
		if (!isInt(raw?.eventoId, 1)) return null;
		const pedido = raw.pedido === undefined || raw.pedido === null ? undefined : lerStatusPedido(raw.pedido);
		if (pedido === null) return null;
		if (raw.status === 'APLICADO' && pedido) out.push({ eventoId: raw.eventoId, status: 'APLICADO', pedido });
		else if (raw.status === 'RECUSADO' && isText(raw.motivo, 300)) out.push({ eventoId: raw.eventoId, status: 'RECUSADO', motivo: raw.motivo, pedido });
		else return null;
	}
	return out;
}
