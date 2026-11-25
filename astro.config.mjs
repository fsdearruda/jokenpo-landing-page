// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import decapCmsOauth from 'astro-decap-cms-oauth';
import icon from 'astro-icon';

try {
	process.loadEnvFile('.env'); // não sobrescreve variáveis já definidas (ex.: as da Vercel)
} catch {
	/* sem .env */
}
const pdvLive = process.env.PUBLIC_PDV_MODE === 'live';

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
		// Com o PDV real (`PUBLIC_PDV_MODE=live`), /produtos é gerada sob demanda para mostrar o
		// catálogo escolhido no PDV; nos outros modos continua estática.
		{
			name: 'jokenpo:produtos-sob-demanda',
			hooks: {
				'astro:route:setup': ({ route }) => {
					if (pdvLive && route.component.endsWith('src/pages/produtos.astro')) route.prerender = false;
				},
			},
		},
		decapCmsOauth({
			adminDisabled: true,
			oauthDisabled: !process.env.OAUTH_GITHUB_CLIENT_ID || !process.env.OAUTH_GITHUB_CLIENT_SECRET,
		}),
	],
});
