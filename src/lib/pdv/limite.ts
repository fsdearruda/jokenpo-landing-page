import { createHash } from 'node:crypto';
import { getSecret } from 'astro:env/server';
import { sql } from '../db';

/** Tentativas de pedido por IP a cada janela. Folgado para quem erra o WhatsApp ou esbarra no estoque. */
export const LIMITE_PEDIDOS = 10;
export const JANELA_MS = 10 * 60_000;

/** Hash do IP com o segredo do site: identifica repetição sem guardar o IP (LGPD). */
export const hashIp = (ip: string) =>
	createHash('sha256').update(`${getSecret('PDV_SYNC_TOKEN') ?? 'jokenpo'}:${ip}`).digest('base64url').slice(0, 32);

/**
 * Conta uma tentativa de pedido do IP e diz se ainda está dentro do limite.
 * A contagem fica no Postgres (as funções da Vercel não compartilham memória);
 * o IP vira um hash com o segredo do site, nunca é guardado. Sem IP conhecido, não limita.
 */
export async function dentroDoLimite(ip: string | undefined, agora = Date.now()): Promise<boolean> {
	if (!ip) return true;
	const janela = Math.floor(agora / JANELA_MS) * JANELA_MS;
	const chave = hashIp(ip);


	const db = sql();
	const [linha] = await db<{ contagem: number }[]>`
		INSERT INTO pdv_limite_ip (chave, janela, contagem) VALUES (${chave}, ${new Date(janela)}, 1)
		ON CONFLICT (chave, janela) DO UPDATE SET contagem = pdv_limite_ip.contagem + 1
		RETURNING contagem`;
	// Faxina ocasional das janelas antigas
	if (Math.random() < 0.02) await db`DELETE FROM pdv_limite_ip WHERE janela < now() - interval '1 day'`;
	return linha.contagem <= LIMITE_PEDIDOS;
}
