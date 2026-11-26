/**
 * Saúde da sincronização com o PC da loja (regras puras, testadas em saude.test.ts).
 * A rota /api/pdv-sync/saude roda de hora em hora no horário da loja (Vercel Schedules) e manda
 * e-mail quando a lista de problemas muda.
 */

/** Com a loja aberta, o PC fala com o site a cada 15 s e manda a foto completa a cada 10 min. */
export const LIMITE_MINUTOS = 30;

export type Problema = 'PC_SEM_CONTATO' | 'ESTOQUE_PARADO' | 'PEDIDOS_PARADOS';

export interface EstadoSync {
	/** Último contato do PC (qualquer rota de sincronização). */
	vistaEm: Date | null;
	/** Último envio de estoque aceito. */
	estoqueEm: Date | null;
	/** Pedidos do site que o PC ainda não confirmou ter recebido. */
	pendentes: number;
	/** O mais antigo deles. */
	pendenteDesde: Date | null;
}

const minutos = (desde: Date | null, agora: number) => (desde ? (agora - desde.getTime()) / 60_000 : Infinity);

export function problemasDaSincronizacao(e: EstadoSync, agora = Date.now()): Problema[] {
	const problemas: Problema[] = [];
	if (minutos(e.vistaEm, agora) > LIMITE_MINUTOS) problemas.push('PC_SEM_CONTATO');
	else if (minutos(e.estoqueEm, agora) > LIMITE_MINUTOS) problemas.push('ESTOQUE_PARADO');
	if (e.pendentes > 0 && minutos(e.pendenteDesde, agora) > LIMITE_MINUTOS) problemas.push('PEDIDOS_PARADOS');
	return problemas;
}

export const chaveDoAlerta = (problemas: Problema[]) => [...problemas].sort().join(',');

const DESCRICAO: Record<Problema, string> = {
	PC_SEM_CONTATO:
		'O PC da loja não fala com o site há mais de 30 minutos. Confira se o PDV está aberto e com internet. Depois de 6 h sem estoque, o site manda os pedidos pelo WhatsApp.',
	ESTOQUE_PARADO:
		'O PC da loja está conectado, mas o site não aceita o estoque dele há mais de 30 minutos (pode ser o relógio do PC atrasado). Enquanto isso, os pedidos no site estão pausados e vão pelo WhatsApp.',
	PEDIDOS_PARADOS:
		'Tem pedido do site esperando o PC da loja há mais de 30 minutos. Ele expira em 72 h se a loja não confirmar.',
};

const hora = (d: Date | null) =>
	d ? d.toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }) : 'nunca';

/** Assunto e texto do e-mail. Lista vazia = aviso de que voltou ao normal. */
export function mensagemDoAlerta(problemas: Problema[], e: EstadoSync) {
	const resumo = [
		`Último contato do PC: ${hora(e.vistaEm)}`,
		`Último estoque aceito: ${hora(e.estoqueEm)}`,
		`Pedidos esperando o PC: ${e.pendentes}${e.pendenteDesde ? ` (o mais antigo desde ${hora(e.pendenteDesde)})` : ''}`,
		'',
		'Log do PDV: C:\\Jokenpo-PDV\\logs (linhas "[site] sincronizado").',
	].join('\n');
	if (!problemas.length) {
		return { assunto: 'Site Jokenpo: sincronização com a loja voltou ao normal', texto: `Tudo certo de novo.\n\n${resumo}` };
	}
	return {
		assunto: `Site Jokenpo: problema na sincronização com a loja (${problemas.length})`,
		texto: `${problemas.map((p) => `- ${DESCRICAO[p]}`).join('\n')}\n\n${resumo}`,
	};
}
