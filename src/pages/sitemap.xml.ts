import type { APIRoute } from 'astro';
import { getPdv } from '../lib/pdv';

// Gerado a cada pedido (com cache na CDN): inclui a página de cada produto que está na vitrine do PDV.
export const prerender = false;

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async () => {
	const siteUrl = import.meta.env.PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://jokenpo.cards';
	const catalogo = await getPdv().listarCatalogo().catch(() => null);
	const urls = [
		`${siteUrl}/`,
		`${siteUrl}/loja`,
		...(catalogo ?? []).flatMap((p) => (p.slug ? [`${siteUrl}/loja/${p.slug}`] : [])),
	];
	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls.map((loc) => `  <url><loc>${xml(loc)}</loc></url>`),
		'</urlset>',
		'',
	].join('\n');
	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
		},
	});
};
