import { getSecret } from 'astro:env/server';

/** Para onde vão os avisos do site (sincronização com a loja). */
export const EMAIL_ALERTAS = 'contato@jokenpo.cards';

/**
 * Envia e-mail pelo Resend (integração da Vercel: `RESEND_API_KEY` e `RESEND_EMAIL_DOMAIN`).
 * O domínio precisa estar verificado no Resend (registros DNS) para entregar.
 */
export async function enviarEmail({ assunto, texto, para = EMAIL_ALERTAS }: { assunto: string; texto: string; para?: string }) {
	const chave = getSecret('RESEND_API_KEY');
	const dominio = getSecret('RESEND_EMAIL_DOMAIN');
	if (!chave || !dominio) throw new Error('Resend não configurado (RESEND_API_KEY / RESEND_EMAIL_DOMAIN)');
	const resposta = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ from: `Site Jokenpo <alertas@${dominio}>`, to: [para], subject: assunto, text: texto }),
		signal: AbortSignal.timeout(10_000),
	});
	if (!resposta.ok) throw new Error(`Resend respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
}
