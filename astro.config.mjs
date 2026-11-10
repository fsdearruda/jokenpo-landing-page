// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import decapCmsOauth from 'astro-decap-cms-oauth';

// https://astro.build/config
export default defineConfig({
	site: 'https://jokenpo.cards',
	output: 'server',
	adapter: vercel(),
	integrations: [
		decapCmsOauth({
			oauthDisabled: !process.env.OAUTH_GITHUB_CLIENT_ID || !process.env.OAUTH_GITHUB_CLIENT_SECRET,
		}),
	],
});
