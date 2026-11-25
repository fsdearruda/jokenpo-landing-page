import { createHash } from 'node:crypto';
import { sql } from '../db';
import { pdvMode } from './index';

/** Tentativas de pedido por IP a cada janela. Folgado para quem erra o WhatsApp ou esbarra no estoque. */
export const LIMITE_PEDIDOS = 10;
export const JANELA_MS = 10 * 60_000;

const memoria = new Map<string, number>();

/**
 * Conta uma tentativa de pedido do IP e diz se ainda está dentro do limite.
 * No modo `live` a contagem fica no Postgres (as funções da Vercel não compartilham memória);
 * o IP vira um hash com o segredo do site, nunca é guardado. Sem IP conhecido, não limita.
 */
export async function dentroDoLimite(ip: string | undefined, agora = Date.now()): Promise<boolean> {
	if (!ip) return true;
	const janela = Math.floor(agora / JANELA_MS) * JANELA_MS;
	const segredo = import.meta.env.PDV_SYNC_TOKEN ?? process.env.PDV_SYNC_TOKEN ?? 'jokenpo';
	const chave = createHash('sha256').update(`${segredo}:${ip}`).digest('base64url').slice(0, 32);

	if (pdvMode !== 'live') {
		const k = `${chave}:${janela}`;
		const n = (memoria.get(k) ?? 0) + 1;
		memoria.set(k, n);
		if (memoria.size > 5_000) memoria.clear();
		return n <= LIMITE_PEDIDOS;
	}

	const db = sql();
	const [linha] = await db<{ contagem: number }[]>`
		INSERT INTO pdv_limite_ip (chave, janela, contagem) VALUES (${chave}, ${new Date(janela)}, 1)
		ON CONFLICT (chave, janela) DO UPDATE SET contagem = pdv_limite_ip.contagem + 1
		RETURNING contagem`;
	// Faxina ocasional das janelas antigas
	if (Math.random() < 0.02) await db`DELETE FROM pdv_limite_ip WHERE janela < now() - interval '1 day'`;
	return linha.contagem <= LIMITE_PEDIDOS;
}
