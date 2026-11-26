import type { ImageMetadata } from 'astro';

/**
 * Fotos de produto enviadas pelo CMS ficam em `src/assets/products/` para passar pelo
 * pipeline de imagens do Astro. O CMS grava o caminho a partir da raiz do repositório.
 */
const assets = import.meta.glob<{ default: ImageMetadata }>('/src/assets/products/*.{jpg,jpeg,png,webp,avif}', {
	eager: true,
});

/** Metadados para o `<Image />`, ou a URL pública quando a foto não está em `src/assets/products/`. */
export const resolveProductImage = (src: string): ImageMetadata | string => {
	const path = src.startsWith('/') ? src : `/${src}`;
	return assets[path]?.default ?? src;
};

/** Tamanhos liberados no otimizador de imagens da Vercel (`imagesConfig.sizes` no astro.config.mjs). */
export const REMOTE_IMAGE_SIZES = [240, 360, 480, 540, 720, 960, 1080, 1440];

/**
 * Imagem redimensionada pelo otimizador da Vercel (`/_vercel/image`): fotos do Vercel Blob (enviadas pelo PDV) e
 * arquivos locais de `/_astro/` em páginas sob demanda (lá o `/_image` do Astro não existe). Fora da Vercel (dev),
 * usa a URL original. As larguras precisam estar em `REMOTE_IMAGE_SIZES`.
 */
export const remoteImage = (url: string, widths: number[]) => {
	const onVercel = import.meta.env.PROD && !!process.env.VERCEL;
	const otimizavel = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(url) || url.startsWith('/_astro/');
	const permitidas = widths.filter((w) => REMOTE_IMAGE_SIZES.includes(w));
	if (!onVercel || !otimizavel || !permitidas.length) return { src: url };
	const at = (w: number) => `/_vercel/image?url=${encodeURIComponent(url)}&w=${w}&q=78`;
	return { src: at(permitidas[permitidas.length - 1]), srcset: permitidas.map((w) => `${at(w)} ${w}w`).join(', ') };
};
