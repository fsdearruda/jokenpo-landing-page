import { families as buildFamilies, variantsById, type PaymentRules, type ProductFamily, type ProductVariant, type Tone } from './catalog';
import { getPdv, pdvMode, type ProdutoCatalogo } from './pdv';
import { acrescimoCartaoDaLoja, ultimoContatoDaLoja } from './pdv/cloud';

export interface Vitrine {
	families: ProductFamily[];
	/** `pdv` = catálogo e estoque ao vivo do PDV; `build` = `products.json` extraído no build. */
	fonte: 'pdv' | 'build';
	/** Última vez que o PC da loja falou com o site (só no modo `live`). */
	lojaVistaEm: string | null;
	/** Acréscimo do cartão definido no PDV, em centésimos de % (null = vale o do CMS). */
	acrescimoCartaoBp: number | null;
}

const TONS: Tone[] = ['cyan', 'yellow', 'pink'];

const slugify = (text: string) =>
	text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'produtos';

const BUILD: Vitrine = { families: buildFamilies, fonte: 'build', lojaVistaEm: null, acrescimoCartaoBp: null };

/** Acréscimo do cartão: o do PDV (Cadastros → Site) quando ele já mandou; senão o do CMS. */
export const regrasPagamento = (acrescimoCartaoBp: number | null, cms: PaymentRules): PaymentRules =>
	acrescimoCartaoBp === null ? cms : { cardFeeEnabled: acrescimoCartaoBp > 0, cardFeePercent: acrescimoCartaoBp / 100 };

/** Card de um produto do PDV. Sem foto no PDV ainda, usa a do CMS antigo pelo id (transição; sai na limpeza da fase 4). */
export function variante(p: ProdutoCatalogo): ProductVariant {
	const titulo = p.nomeSite ?? p.nome;
	const antigo = variantsById.get(p.produtoId);
	const fotos = p.fotos ?? [];
	return {
		id: p.produtoId,
		sku: p.sku,
		label: titulo,
		title: titulo,
		pdvName: p.nome,
		priceCents: p.precoCentavos,
		stock: p.disponivel,
		pdvPromo: p.promocao ?? null,
		images: fotos.length ? fotos.map((src, i) => ({ src, alt: i === 0 ? titulo : '' })) : antigo?.variant.images,
		swatch: antigo?.variant.swatch,
		visual: p.carta ? 'carta' : (antigo?.family.type ?? 'generic'),
		carta: p.carta ?? null,
		description: p.descricao ?? null,
		slug: p.slug ?? null,
		featured: p.destaque ?? false,
	};
}

/**
 * Monta as seções da vitrine a partir do PDV (modo `live`): uma seção por grupo de categoria, na ordem das
 * categorias do PDV; dentro da seção, destaques primeiro. O que aparece, o nome, a descrição e as fotos são
 * decididos no PDV (Cadastros → Produtos e Cadastros → Site).
 */
export async function carregarVitrine(): Promise<Vitrine> {
	const pdv = getPdv();
	if (pdvMode !== 'live' || !pdv) return BUILD;

	try {
		const [catalogo, vistaEm, acrescimoCartaoBp] = await Promise.all([pdv.listarCatalogo(), ultimoContatoDaLoja(), acrescimoCartaoDaLoja()]);
		// Loja ainda não sincronizou nenhuma vez: mostra o catálogo do build (pedido pelo WhatsApp)
		if (!catalogo || !vistaEm) return BUILD;

		const grupos = new Map<string, ProdutoCatalogo[]>();
		for (const p of catalogo) {
			const grupo = p.grupo ?? 'Outros produtos';
			grupos.set(grupo, [...(grupos.get(grupo) ?? []), p]);
		}
		const ordem = (produtos: ProdutoCatalogo[]) => Math.min(...produtos.map((p) => p.ordemGrupo ?? Number.MAX_SAFE_INTEGER));
		const slugs = new Set<string>();
		const families: ProductFamily[] = [...grupos.entries()]
			.sort(([a, pa], [b, pb]) => ordem(pa) - ordem(pb) || a.localeCompare(b, 'pt-BR'))
			.map(([grupo, produtos], index) => {
				let slug = slugify(grupo);
				while (slugs.has(slug)) slug += '-2';
				slugs.add(slug);
				const variants = produtos
					.map(variante)
					.sort((a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title, 'pt-BR'));
				return {
					slug,
					type: 'generic',
					tone: TONS[index % TONS.length],
					name: grupo,
					category: grupo,
					subtitle: grupo,
					description: '',
					variantLabel: 'Produto',
					variants,
				};
			});

		return { families, fonte: 'pdv', lojaVistaEm: vistaEm.toISOString(), acrescimoCartaoBp };
	} catch (error) {
		// Banco fora do ar: a página continua com o catálogo do build e o pedido pelo WhatsApp
		console.error('[vitrine] catálogo do PDV indisponível', error instanceof Error ? error.message : error);
		return BUILD;
	}
}
