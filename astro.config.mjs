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
			// Checagem de saúde (Vercel Schedules) e e-mail de alerta pelo Resend (integração da Vercel)
			// Sal do hash de IP do limite de pedidos (sem ele, usa PDV_SYNC_TOKEN)
			IP_HASH_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
			CRON_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
			RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
			RESEND_EMAIL_DOMAIN: envField.string({ context: 'server', access: 'secret', optional: true }),
			// false = pedido só pelo WhatsApp (o catálogo continua). Lido no build: mudar exige novo deploy.
			PEDIDOS_NO_SITE: envField.boolean({ context: 'server', access: 'public', default: true }),
		},
	},
	// imagesConfig liga o otimizador da Vercel (/_vercel/image) para as fotos de produto no Vercel Blob
	adapter: vercel({
		imagesConfig: {
			sizes: [240, 360, 480, 540, 720, 960, 1080, 1440], // = REMOTE_IMAGE_SIZES em src/lib/product-images.ts
			formats: ['image/avif', 'image/webp'],
			remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
		},
	}),
	integrations: [
		// Ícones resolvidos em build e inlinados como SVG: zero JS e zero requisições.
		// `include` limita o bundle SSR aos glifos usados; adicione novos nomes aqui.
		icon({
			include: {
				lucide: ['arrow-right', 'arrow-up-right', 'arrow-down', 'arrow-up', 'plus', 'minus', 'x', 'shopping-bag', 'chevron-left', 'chevron-right', 'pause', 'play'],
				'simple-icons': ['whatsapp'],
			},
		}),
		decapCmsOauth({
			adminDisabled: true,
			oauthDisabled: !process.env.OAUTH_GITHUB_CLIENT_ID || !process.env.OAUTH_GITHUB_CLIENT_SECRET,
		}),
	],
});
