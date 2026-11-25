// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import decapCmsOauth from 'astro-decap-cms-oauth';
import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
	site: 'https://jokenpo.cards',
	compressHTML: true,
	build: {
		inlineStylesheets: 'always',
	},
	// `server` mantém as rotas OAuth do Decap CMS sob demanda. As páginas públicas
	// usam `export const prerender = true` e são servidas como HTML estático.
	output: 'server',
	adapter: vercel(),
	integrations: [
		// Ícones resolvidos em build e inlinados como SVG: zero JS e zero requisições.
		// `include` limita o bundle SSR aos glifos usados; adicione novos nomes aqui.
		icon({
			include: {
				lucide: ['arrow-right', 'arrow-up-right', 'arrow-down', 'arrow-up', 'plus', 'minus', 'x', 'shopping-bag'],
				'simple-icons': ['whatsapp'],
			},
		}),
		decapCmsOauth({
			adminDisabled: true,
			oauthDisabled: !process.env.OAUTH_GITHUB_CLIENT_ID || !process.env.OAUTH_GITHUB_CLIENT_SECRET,
		}),
	],
});
