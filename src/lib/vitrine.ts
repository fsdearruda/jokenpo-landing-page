import type { PaymentRules, ProductFamily, ProductVariant, Tone } from './catalog';
import { getPdv, type ProdutoCatalogo } from './pdv';
import { descontoPixDaLoja, ultimoContatoDaLoja } from './pdv/cloud';

export interface Vitrine {
	families: ProductFamily[];
	/** O catálogo do PDV carregou (false = banco fora do ar ou loja que nunca sincronizou). */
	disponivel: boolean;
	/** Última vez que o PC da loja falou com o site. */
	lojaVistaEm: string | null;
	/** Desconto no Pix definido no PDV, em centésimos de % (null = o PDV ainda não mandou). */
	descontoPixBp: number | null;
}

const TONS: Tone[] = ['cyan', 'yellow', 'pink'];

const slugify = (text: string) =>
	text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'produtos';

const VAZIA: Vitrine = { families: [], disponivel: false, lojaVistaEm: null, descontoPixBp: null };

/** Desconto no Pix definido no PDV (Cadastros → Site); sem ele, Pix e cartão custam o mesmo. */
export const regrasPagamento = (descontoPixBp: number | null): PaymentRules => ({ pixDiscountPercent: (descontoPixBp ?? 0) / 100 });

/** Card de um produto do PDV. */
export function variante(p: ProdutoCatalogo): ProductVariant {
	const titulo = p.nomeSite ?? p.nome;
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
		images: fotos.map((src, i) => ({ src, alt: i === 0 ? titulo : '' })),
		description: p.descricao ?? null,
		slug: p.slug ?? null,
		featured: p.destaque ?? false,
		carta: p.carta ?? null,
	};
}

/**
 * Monta as seções da vitrine a partir do PDV: uma seção por grupo de categoria, na ordem das categorias do PDV;
 * dentro da seção, destaques primeiro. O que aparece, o nome, a descrição e as fotos são decididos no PDV
 * (Cadastros → Produtos e Cadastros → Site).
 */
export async function carregarVitrine(): Promise<Vitrine> {
	try {
		const [catalogo, vistaEm, descontoPixBp] = await Promise.all([getPdv().listarCatalogo(), ultimoContatoDaLoja(), descontoPixDaLoja()]);
		// Loja que nunca sincronizou: vitrine vazia com o WhatsApp
		if (!vistaEm) return VAZIA;

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
				return {
					slug,
					name: grupo,
					category: grupo,
					tone: TONS[index % TONS.length],
					variants: produtos
						.map(variante)
						.sort((a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title, 'pt-BR')),
				};
			});

		return { families, disponivel: true, lojaVistaEm: vistaEm.toISOString(), descontoPixBp };
	} catch (error) {
		// Banco fora do ar: a CDN segue servindo a última página boa (stale-while-revalidate); sem ela, vitrine vazia
		console.error('[vitrine] catálogo do PDV indisponível', error instanceof Error ? error.message : error);
		return VAZIA;
	}
}
