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
export const REMOTE_IMAGE_SIZES = [240, 360, 480, 720, 960, 1440];

/**
 * Foto remota (Vercel Blob, enviada pelo PDV) redimensionada pelo otimizador da Vercel (`/_vercel/image`).
 * Fora da Vercel (dev), usa a URL original.
 */
export const remoteImage = (url: string, widths: number[]) => {
	const onVercel = import.meta.env.PROD && !!process.env.VERCEL;
	if (!onVercel || !/^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(url)) return { src: url };
	const at = (w: number) => `/_vercel/image?url=${encodeURIComponent(url)}&w=${w}&q=78`;
	return { src: at(widths[widths.length - 1]), srcset: widths.map((w) => `${at(w)} ${w}w`).join(', ') };
};
