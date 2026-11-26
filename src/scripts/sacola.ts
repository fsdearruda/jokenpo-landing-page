/**
 * Sacola e pedido guardados no navegador (localStorage), usados pela /loja e pela página do produto.
 * Tudo que vem do localStorage ou da API passa por um guarda: dado corrompido ou de uma versão antiga
 * vira "vazio", nunca um erro na página.
 */

export type Line = { id: string; qty: number };

export type OrderStatus = 'AGUARDANDO_CONFIRMACAO' | 'PAGAMENTO_PENDENTE' | 'PAGO' | 'ENTREGUE' | 'RECUSADO' | 'CANCELADO' | 'EXPIRADO';
export const ORDER_STATUSES: readonly OrderStatus[] = [
	'AGUARDANDO_CONFIRMACAO',
	'PAGAMENTO_PENDENTE',
	'PAGO',
	'ENTREGUE',
	'RECUSADO',
	'CANCELADO',
	'EXPIRADO',
];

export type SavedOrder = {
	id: string;
	numero: number;
	status: OrderStatus;
	itens: { descricao: string; quantidade: number; precoUnitarioCentavos?: number }[];
	totalCentavos: number;
	validoAte: string | null;
	motivo: string | null;
	/** Desconto no Pix gravado no pedido; ausente/null = pedido antigo, vale o da página. */
	descontoPixBp?: number | null;
};

export const SACOLA_KEY = 'jokenpo:sacola';
export const PEDIDO_KEY = 'jokenpo:pedido';

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const textoOuNull = (v: unknown) => v === null || v === undefined || typeof v === 'string';

export const ehLinha = (v: unknown): v is Line =>
	objeto(v) && typeof v.id === 'string' && v.id.length > 0 && Number.isInteger(v.qty) && (v.qty as number) > 0;

export const ehStatus = (v: unknown): v is OrderStatus => ORDER_STATUSES.includes(v as OrderStatus);

export const ehPedido = (v: unknown): v is SavedOrder =>
	objeto(v) &&
	typeof v.id === 'string' &&
	Number.isInteger(v.numero) &&
	ehStatus(v.status) &&
	Number.isInteger(v.totalCentavos) &&
	Array.isArray(v.itens) &&
	v.itens.every((i) => objeto(i) && typeof i.descricao === 'string' && Number.isInteger(i.quantidade)) &&
	textoOuNull(v.validoAte) &&
	textoOuNull(v.motivo) &&
	(v.descontoPixBp === undefined || v.descontoPixBp === null || Number.isInteger(v.descontoPixBp));

const ler = (chave: string): unknown => {
	try {
		return JSON.parse(localStorage.getItem(chave) ?? 'null');
	} catch {
		return null; // JSON quebrado ou armazenamento bloqueado
	}
};

const gravar = (chave: string, valor: unknown) => {
	try {
		if (valor === null) localStorage.removeItem(chave);
		else localStorage.setItem(chave, JSON.stringify(valor));
		return true;
	} catch {
		return false; // navegação privada ou armazenamento cheio/bloqueado
	}
};

export const lerSacola = (): Line[] => {
	const v = ler(SACOLA_KEY);
	return Array.isArray(v) ? v.filter(ehLinha) : [];
};
export const gravarSacola = (linhas: Line[]) => gravar(SACOLA_KEY, linhas);

/** Soma uma unidade do produto, até `max`. */
export function adicionarNaSacola(id: string, max: number): 'ok' | 'no-maximo' | 'sem-armazenamento' {
	const linhas = lerSacola();
	const linha = linhas.find((l) => l.id === id);
	if (linha && linha.qty >= max) return 'no-maximo';
	if (linha) linha.qty += 1;
	else linhas.push({ id, qty: 1 });
	return gravarSacola(linhas) ? 'ok' : 'sem-armazenamento';
}

export const lerPedido = (): SavedOrder | null => {
	const v = ler(PEDIDO_KEY);
	return ehPedido(v) ? v : null;
};
export const gravarPedido = (pedido: SavedOrder | null) => gravar(PEDIDO_KEY, pedido);

/** Item que faltou no estoque, como a API devolve em `erro.detalhes`. */
export type Falta = { produtoId: string; disponivel: number };
export const ehFalta = (v: unknown): v is Falta => objeto(v) && typeof v.produtoId === 'string' && Number.isInteger(v.disponivel);

/** Estoque ao vivo de `/api/pdv/estoque`. */
export type EstoqueAoVivo = { produtoId: string; disponivel: number; precoCentavos?: number };
export const ehEstoque = (v: unknown): v is EstoqueAoVivo =>
	ehFalta(v) && ((v as Record<string, unknown>).precoCentavos === undefined || Number.isInteger((v as Record<string, unknown>).precoCentavos));

/** Erro padrão das rotas `/api/pdv/*`. */
export type ErroApi = { codigo?: string; mensagem?: string; detalhes?: unknown };
export const erroDa = (data: unknown): ErroApi | undefined =>
	objeto(data) && objeto(data.erro)
		? {
				codigo: typeof data.erro.codigo === 'string' ? data.erro.codigo : undefined,
				mensagem: typeof data.erro.mensagem === 'string' ? data.erro.mensagem : undefined,
				detalhes: data.erro.detalhes,
			}
		: undefined;
