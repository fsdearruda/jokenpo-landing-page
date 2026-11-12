// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import decapCmsOauth from 'astro-decap-cms-oauth';

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
		decapCmsOauth({
			adminDisabled: true,
			oauthDisabled: !process.env.OAUTH_GITHUB_CLIENT_ID || !process.env.OAUTH_GITHUB_CLIENT_SECRET,
		}),
	],
});
