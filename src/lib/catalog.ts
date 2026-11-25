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
	/** Fotos editadas no CMS. A primeira vai no card; a segunda aparece no hover. */
	images?: ProductImage[];
	/** Promoção ligada no CMS. O preço cobrado continua vindo do PDV. */
	promo?: ProductPromo;
	/** Promoção criada no PDV (modo `live`). Tem prioridade sobre a do CMS. */
	pdvPromo?: { nome: string; precoOriginalCentavos: number; terminaEm: string } | null;
}

export interface ProductImage {
	/** Caminho no repositório (`/src/assets/products/...`) ou URL pública. */
	src: string;
	alt: string;
}

export interface ProductPromo {
	active: boolean;
	/** Preço "de" (riscado), em reais. Só aparece se for maior que o preço do PDV. */
	compareAtPrice?: number | null;
	/** Texto do selo; vazio usa o desconto calculado ou o selo padrão. */
	badge?: string;
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

export interface PaymentRules {
	/** Liga a taxa do cartão. Desligada, o cartão custa o mesmo que o Pix. */
	cardFeeEnabled: boolean;
	/** Acréscimo no cartão, em %, sobre o preço do PDV (que é o preço no Pix). */
	cardFeePercent: number;
}

/** O preço do PDV é o preço no Pix; o cartão leva a taxa do CMS, arredondada ao centavo. */
export const cardPrice = (cents: number, rules: PaymentRules) =>
	rules.cardFeeEnabled && rules.cardFeePercent > 0 ? Math.round(cents * (1 + rules.cardFeePercent / 100)) : cents;

type PromoFields = Pick<ProductVariant, 'promo' | 'pdvPromo' | 'priceCents'>;

/**
 * Preço "de" em centavos, só quando há promoção e o valor é maior que o preço atual.
 * A promoção do PDV vence; a do CMS vale quando o PDV não manda nenhuma (ex.: site sem PDV ligado).
 */
export const compareAtCents = (variant: PromoFields) => {
	if (variant.pdvPromo) return variant.pdvPromo.precoOriginalCentavos > variant.priceCents ? variant.pdvPromo.precoOriginalCentavos : null;
	const promo = variant.promo;
	if (!promo?.active || !promo.compareAtPrice) return null;
	const cents = Math.round(promo.compareAtPrice * 100);
	return cents > variant.priceCents ? cents : null;
};

/** Texto do selo: nome da promoção do PDV; senão o selo do CMS, o desconto em % ou o selo padrão. */
export const promoBadge = (variant: PromoFields, fallback: string) => {
	if (variant.pdvPromo) return variant.pdvPromo.nome;
	if (!variant.promo?.active) return null;
	if (variant.promo.badge?.trim()) return variant.promo.badge.trim();
	const before = compareAtCents(variant);
	if (before) return `-${Math.round((1 - variant.priceCents / before) * 100)}%`;
	return fallback;
};

/** Até este número de unidades a vitrine mostra "Últimas unidades". */
export const LOW_STOCK_THRESHOLD = 3;
