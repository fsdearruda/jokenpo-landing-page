// @ts-check
import { defineConfig, envField } from 'astro/config';
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
	// A vitrine mudou de /produtos para /loja; links antigos continuam funcionando.
	redirects: {
		'/produtos': { status: 301, destination: '/loja' },
	},
	build: {
		inlineStylesheets: 'always',
	},
	// `server` mantém as rotas OAuth do Decap CMS sob demanda. As páginas públicas
	// usam `export const prerender = true` e são servidas como HTML estático.
	output: 'server',
	// Segredos lidos em tempo de execução (não ficam gravados no bundle e trocam sem rebuild)
	env: {
		schema: {
			DATABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
			PDV_SYNC_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
			PDV_MOCK_ADMIN_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
		},
	},
	adapter: vercel(),
	integrations: [
		// Ícones resolvidos em build e inlinados como SVG: zero JS e zero requisições.
		// `include` limita o bundle SSR aos glifos usados; adicione novos nomes aqui.
		icon({
			include: {
				lucide: ['arrow-right', 'arrow-up-right', 'arrow-down', 'arrow-up', 'plus', 'minus', 'x', 'shopping-bag', 'chevron-left', 'chevron-right', 'pause', 'play'],
				'simple-icons': ['whatsapp'],
			},
		}),
		// Com o PDV real (`PUBLIC_PDV_MODE=live`), /loja é gerada sob demanda para mostrar o
		// catálogo escolhido no PDV; nos outros modos continua estática.
		{
			name: 'jokenpo:loja-sob-demanda',
			hooks: {
				'astro:route:setup': ({ route }) => {
					if (pdvLive && route.component.endsWith('src/pages/loja.astro')) route.prerender = false;
				},
			},
		},
		decapCmsOauth({
			adminDisabled: true,
			oauthDisabled: !process.env.OAUTH_GITHUB_CLIENT_ID || !process.env.OAUTH_GITHUB_CLIENT_SECRET,
		}),
	],
});
