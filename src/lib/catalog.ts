import products from '../data/products.json';

export type ProductType = 'shield' | 'deckbox' | 'triple' | 'generic';
export type Tone = 'cyan' | 'yellow' | 'pink';

export interface ProductVariant {
	/** `Produto.id` no PDV. */
	id: string;
	sku: string | null;
	label: string;
	/** Nome mostrado no card, na sacola e no comprovante. */
	title: string;
	/** Nome no cadastro do PDV. */
	pdvName: string;
	priceCents: number;
	/** Estoque disponível no momento da extração (`estoque - estoqueReservado`). */
	stock: number;
	swatch?: 'black' | 'purple';
}

export interface ProductFamily {
	slug: string;
	type: ProductType;
	name: string;
	/** Título da seção na vitrine. */
	category: string;
	subtitle: string;
	description: string;
	variantLabel: string;
	variants: ProductVariant[];
	/** Cor da seção; sem isto vem do tipo. Usado nas seções montadas a partir das categorias do PDV. */
	tone?: Tone;
}

export const productTypes: Record<ProductType, { label: string; plural: string; color: Tone }> = {
	shield: { label: 'Shield', plural: 'Shields', color: 'cyan' },
	deckbox: { label: 'Deck box', plural: 'Deck boxes', color: 'yellow' },
	triple: { label: 'Triple pack', plural: 'Triple packs', color: 'pink' },
	generic: { label: 'Produto', plural: 'Produtos', color: 'cyan' },
};

export const toneOf = (family: ProductFamily): Tone => family.tone ?? productTypes[family.type].color;

export const catalog = products as { source: string; extractedAt: string; families: ProductFamily[] };

export const families = catalog.families.filter((family) => family.variants.length > 0);

export const variantsById = new Map(
	families.flatMap((family) => family.variants.map((variant) => [variant.id, { family, variant }] as const)),
);

/** Formata centavos no padrão da marca: `R$ 25` ou `R$ 59,90`. */
export const formatPrice = (cents: number) => {
	const reais = Math.floor(cents / 100);
	const rest = cents % 100;
	return rest === 0 ? `R$ ${reais}` : `R$ ${reais},${String(rest).padStart(2, '0')}`;
};

/** Até este número de unidades a vitrine mostra "Últimas unidades". */
export const LOW_STOCK_THRESHOLD = 3;
