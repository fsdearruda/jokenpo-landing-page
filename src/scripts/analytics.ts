/**
 * Eventos do Umami (src/components/Analytics.astro). Sem PUBLIC_UMAMI_WEBSITE_ID, ou fora de jokenpo.cards,
 * nada é enviado. O script carrega depois da página; eventos anteriores ficam na fila até ele chegar.
 *
 * Nunca mande nome, telefone, id do pedido ou o texto do WhatsApp: só rótulos, códigos e valores.
 */
type Dados = Record<string, string | number | boolean>;

declare global {
	interface Window {
		umami?: { track: (evento: string, dados?: Dados) => void };
	}
}

const fila: Array<[string, Dados | undefined]> = [];

export function registrar(evento: string, dados?: Dados) {
	try {
		if (window.umami) window.umami.track(evento, dados);
		else if (fila.length < 20) fila.push([evento, dados]);
	} catch {
		/* Analytics nunca quebra a página. */
	}
}

document.addEventListener(
	'umami:pronto',
	() => {
		fila.splice(0).forEach(([evento, dados]) => registrar(evento, dados));
	},
	{ once: true },
);
