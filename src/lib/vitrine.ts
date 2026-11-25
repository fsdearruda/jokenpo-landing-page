import { families as buildFamilies, type ProductFamily, type Tone } from './catalog';
import { getPdv, pdvMode } from './pdv';
import { ultimoContatoDaLoja } from './pdv/cloud';

export interface Vitrine {
	families: ProductFamily[];
	/** `pdv` = catálogo e estoque ao vivo do PDV; `build` = `products.json` extraído no build. */
	fonte: 'pdv' | 'build';
	/** Última vez que o PC da loja falou com o site (só no modo `live`). */
	lojaVistaEm: string | null;
}

const TONS: Tone[] = ['cyan', 'yellow', 'pink'];

const slugify = (text: string) =>
	text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'produtos';

/**
 * Monta as seções da vitrine.
 *
 * No modo `live`, o que aparece é decidido no PDV (Cadastros → Site): produto marcado lá
 * entra aqui com preço e estoque do PDV. As famílias de `products.json` continuam valendo
 * só como apresentação (título, rótulo, ilustração) para os ids que elas conhecem; os
 * demais produtos entram numa seção por categoria do PDV.
 */
export async function carregarVitrine(): Promise<Vitrine> {
	const pdv = getPdv();
	if (pdvMode !== 'live' || !pdv) return { families: buildFamilies, fonte: 'build', lojaVistaEm: null };

	try {
		const [catalogo, vistaEm] = await Promise.all([pdv.listarCatalogo(), ultimoContatoDaLoja()]);
		// Loja ainda não sincronizou nenhuma vez: mostra o catálogo do build (pedido pelo WhatsApp)
		if (!catalogo || !vistaEm) return { families: buildFamilies, fonte: 'build', lojaVistaEm: null };
		const porId = new Map(catalogo.map((p) => [p.produtoId, p]));
		const usados = new Set<string>();

		const curadas = buildFamilies
			.map((family) => ({
				...family,
				variants: family.variants
					.filter((v) => porId.has(v.id))
					.map((v) => {
						const p = porId.get(v.id)!;
						usados.add(v.id);
						return { ...v, pdvName: p.nome, priceCents: p.precoCentavos, stock: p.disponivel };
					}),
			}))
			.filter((family) => family.variants.length > 0);

		const grupos = new Map<string, typeof catalogo>();
		for (const p of catalogo) {
			if (usados.has(p.produtoId)) continue;
			const grupo = p.grupo ?? 'Outros produtos';
			grupos.set(grupo, [...(grupos.get(grupo) ?? []), p]);
		}
		const slugs = new Set(curadas.map((f) => f.slug));
		const doPdv: ProductFamily[] = [...grupos.entries()]
			.sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
			.map(([grupo, produtos], index) => {
				let slug = slugify(grupo);
				while (slugs.has(slug)) slug += '-2';
				slugs.add(slug);
				return {
					slug,
					type: 'generic',
					tone: TONS[(curadas.length + index) % TONS.length],
					name: grupo,
					category: grupo,
					subtitle: grupo,
					description: '',
					variantLabel: 'Produto',
					variants: produtos.map((p) => ({
						id: p.produtoId,
						sku: p.sku,
						label: p.nome,
						title: p.nome,
						pdvName: p.nome,
						priceCents: p.precoCentavos,
						stock: p.disponivel,
					})),
				};
			});

		return { families: [...curadas, ...doPdv], fonte: 'pdv', lojaVistaEm: vistaEm?.toISOString() ?? null };
	} catch (error) {
		// Banco fora do ar: a página continua com o catálogo do build e o pedido pelo WhatsApp
		console.error('[vitrine] catálogo do PDV indisponível', error instanceof Error ? error.message : error);
		return { families: buildFamilies, fonte: 'build', lojaVistaEm: null };
	}
}
