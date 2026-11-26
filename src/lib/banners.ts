import type { ImageMetadata } from 'astro';
import siteData from '../data/site.json';

export type BannerPlacement = 'loja' | 'inicio';

export interface BannerSlide {
	/** Caminho no repositório (`/src/assets/banners/...`) gravado pelo CMS, ou URL pública. */
	src: string;
	alt: string;
}

export interface Banner {
	title: string;
	active: boolean;
	placement: BannerPlacement[];
	/** `AAAA-MM-DD`; vazio = desde já. */
	startDate?: string;
	/** `AAAA-MM-DD`, inclusivo; vazio = sem fim. */
	endDate?: string;
	link?: string;
	/** Texto do botão no bloco da página inicial. */
	cta?: string;
	/** Segundos entre as fotos do carrossel. */
	interval?: number;
	/** Na ordem em que giram; a ordem é a da lista no CMS. */
	slides: BannerSlide[];
}

const assets = import.meta.glob<{ default: ImageMetadata }>('/src/assets/banners/*.{jpg,jpeg,png,webp,avif}', {
	eager: true,
});

export const resolveBannerImage = (src: string): ImageMetadata | string => {
	const path = src.startsWith('/') ? src : `/${src}`;
	return assets[path]?.default ?? src;
};

export type BannerShape = 'wide' | 'square' | 'tall';

/** Formato da moldura a partir da foto: largo (faixa), quadrado ou em pé (stories/feed). */
export const bannerShape = (width: number, height: number): BannerShape => {
	const ratio = width / height;
	return ratio >= 1.4 ? 'wide' : ratio > 0.9 ? 'square' : 'tall';
};

/** Proporção e formato do banner, tirados da 1ª foto. */
export const bannerFrame = (banner: Banner): { ratio: string; shape: BannerShape } => {
	const first = resolveBannerImage(banner.slides[0].src);
	if (typeof first === 'string') return { ratio: '4 / 5', shape: 'tall' };
	return { ratio: `${first.width} / ${first.height}`, shape: bannerShape(first.width, first.height) };
};

const ddmm = (date: string) => date.slice(0, 10).split('-').reverse().slice(0, 2).join('/');

/** Período escrito para a página: `26/11 até 28/11`, `Até 28/11` ou `A partir de 26/11`. */
export const bannerPeriod = (banner: Banner) => {
	const { startDate: start, endDate: end } = banner;
	if (start && end) return start.slice(0, 10) === end.slice(0, 10) ? `Só em ${ddmm(end)}` : `${ddmm(start)} até ${ddmm(end)}`;
	if (end) return `Até ${ddmm(end)}`;
	if (start) return `A partir de ${ddmm(start)}`;
	return '';
};

/** Data de hoje em Natal (UTC−3), no formato do CMS. */
const today = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Banner agendado para começar depois de hoje: vai oculto e o navegador mostra no dia. */
export const isUpcoming = (banner: Banner) => Boolean(banner.startDate && banner.startDate.slice(0, 10) > today());

/**
 * Banners ligados para o local, ainda no período e com ao menos uma foto. As datas também
 * são checadas no navegador, para o banner aparecer e sumir sem um novo build.
 */
export const activeBanners = (placement: BannerPlacement, shapes?: BannerShape[]): Banner[] => {
	const now = today();
	return ((siteData as { banners?: Banner[] }).banners ?? []).filter(
		(banner) =>
			banner.active &&
			banner.placement?.includes(placement) &&
			banner.slides?.length > 0 &&
			(!banner.endDate || banner.endDate.slice(0, 10) >= now) &&
			(!shapes || shapes.includes(bannerFrame(banner).shape)),
	);
};
