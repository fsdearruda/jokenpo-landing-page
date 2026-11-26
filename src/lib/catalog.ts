import type { CartaFoto } from './pdv/sync';

/**
 * Tipos e regras de apresentação da vitrine. Os dados (produtos, preço, estoque, conteúdo, fotos e promoções)
 * vêm todos do PDV da loja: ver `vitrine.ts`.
 */

export type Tone = 'cyan' | 'yellow' | 'pink';

export interface ProductVariant {
	/** `Produto.id` no PDV. */
	id: string;
	sku: string | null;
	label: string;
	/** Nome mostrado no card, na sacola e no comprovante (nome de vitrine do PDV, ou o nome). */
	title: string;
	/** Nome no cadastro do PDV. */
	pdvName: string;
	priceCents: number;
	/** Disponível no site (estoque do PDV menos os pedidos que a loja ainda não confirmou). */
	stock: number;
	/** Fotos enviadas pelo PDV. A primeira vai no card; a segunda aparece no hover. */
	images?: ProductImage[];
	/** Promoção vigente criada no PDV. */
	pdvPromo?: { nome: string; precoOriginalCentavos: number; terminaEm: string } | null;
	description?: string | null;
	slug?: string | null;
	featured?: boolean;
	/** Carta avulsa: dados para o cartão de texto e os filtros. */
	carta?: CartaFoto | null;
}

export interface ProductImage {
	src: string;
	alt: string;
}

export interface ProductFamily {
	slug: string;
	name: string;
	/** Título da seção na vitrine (grupo de categoria do PDV). */
	category: string;
	variants: ProductVariant[];
	tone: Tone;
}

/** Formata centavos no padrão da marca: `R$ 25` ou `R$ 59,90`. */
export const formatPrice = (cents: number) => {
	const reais = Math.floor(cents / 100);
	const rest = cents % 100;
	return rest === 0 ? `R$ ${reais}` : `R$ ${reais},${String(rest).padStart(2, '0')}`;
};

export interface PaymentRules {
	/** Liga o acréscimo do cartão. Desligado, o cartão custa o mesmo que o Pix. */
	cardFeeEnabled: boolean;
	/** Acréscimo no cartão, em %, sobre o preço do PDV (que é o preço no Pix). */
	cardFeePercent: number;
}

/** O preço do PDV é o preço no Pix; o cartão leva o acréscimo definido no PDV, arredondado ao centavo. */
export const cardPrice = (cents: number, rules: PaymentRules) =>
	rules.cardFeeEnabled && rules.cardFeePercent > 0 ? Math.round(cents * (1 + rules.cardFeePercent / 100)) : cents;

type PromoFields = Pick<ProductVariant, 'pdvPromo' | 'priceCents'>;

/** Preço "de" em centavos, só quando há promoção do PDV e o valor é maior que o preço atual. */
export const compareAtCents = (variant: PromoFields) =>
	variant.pdvPromo && variant.pdvPromo.precoOriginalCentavos > variant.priceCents ? variant.pdvPromo.precoOriginalCentavos : null;

/** Texto do selo: o nome da promoção do PDV. */
export const promoBadge = (variant: PromoFields) => variant.pdvPromo?.nome ?? null;

/** Até este número de unidades a vitrine mostra "Últimas unidades". */
export const LOW_STOCK_THRESHOLD = 3;

/** Nomes que o cliente entende, para os códigos do PDV. */
export const JOGOS: Record<string, string> = { MAGIC: 'Magic', POKEMON: 'Pokémon', YUGIOH: 'Yu-Gi-Oh!', ONE_PIECE: 'One Piece', LORCANA: 'Lorcana' };
export const CONDICOES: Record<string, string> = { NM: 'Quase nova (NM)', SP: 'Pouco jogada (SP)', MP: 'Jogada (MP)', HP: 'Muito jogada (HP)', DMG: 'Danificada (DMG)' };
export const IDIOMAS: Record<string, string> = { PT: 'Português', EN: 'Inglês', JP: 'Japonês', ES: 'Espanhol', IT: 'Italiano', FR: 'Francês', DE: 'Alemão', KR: 'Coreano', CN: 'Chinês' };
export const nomeDe = (mapa: Record<string, string>, codigo: string) => mapa[codigo] ?? codigo;
