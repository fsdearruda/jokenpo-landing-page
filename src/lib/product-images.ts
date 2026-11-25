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
