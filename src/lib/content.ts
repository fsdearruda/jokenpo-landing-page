import { z } from 'astro/zod';
import bruto from '../data/site.json';

/**
 * Conteúdo da landing (`src/data/site.json`, editado pelo Decap CMS), conferido no build.
 *
 * O CMS commita direto no `main`; um campo apagado, renomeado ou com valor fora das opções quebrava a
 * página em silêncio. Com o schema, o build falha, a Vercel não publica e o site no ar segue o anterior.
 * Mantenha os campos alinhados com `public/admin/config.yml` (o teste `content.test.ts` confere as chaves).
 * Componentes importam daqui, nunca do JSON direto.
 */

const texto = z.string().trim().min(1);
const cor = z.enum(['cyan', 'yellow', 'pink']);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use HH:MM (24h)');
const dataCms = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'use AAAA-MM-DD');
const diaSchema = z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

const passe = z.object({ title: texto, schedule: texto, price: texto, note: z.string(), color: cor });

export const siteSchema = z.object({
	name: texto,
	shortName: z.string().optional(),
	title: texto,
	description: texto,
	contact: z.object({
		instagram: z.url(),
		communityWhatsapp: z.url(),
		whatsapp: texto,
		email: z.email(),
		cnpj: z.string().optional(),
	}),
	location: z.object({
		venue: texto,
		street: texto,
		neighborhood: texto,
		postalCode: texto,
		mapsUrl: z.url(),
		embedUrl: z.url(),
	}),
	hours: z
		.array(
			z.object({
				day: texto,
				open: texto,
				closed: z.boolean().optional(),
				opens: hhmm.optional(),
				closes: hhmm.optional(),
				/** Dias para o Google (schema.org). Vazio = deduzido do texto em `day`. */
				schemaDays: z.array(diaSchema).optional(),
			}),
		)
		.min(1),
	hero: z.object({
		eyebrow: z.string(),
		titleLine1: texto,
		titleLine2: z.string(),
		titleLine3: z.string(),
		description: texto,
		communityButtonColor: z.string().optional(),
	}),
	howItWorks: z.object({
		eyebrow: z.string(),
		title: texto,
		highlight: z.string(),
		lead: z.string(),
		steps: z.array(z.object({ number: texto, title: texto, description: texto, color: cor })),
	}),
	about: z.object({
		eyebrow: z.string(),
		titleLine1: texto,
		highlight: z.string(),
		description: texto,
		tcgs: z.array(texto),
		noteLine1: z.string(),
		noteHighlight: z.string(),
		noteAuthor: z.string(),
	}),
	agenda: z.array(
		z.object({ day: z.enum(['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']), name: texto, detail: texto, color: cor }),
	),
	extras: z.array(z.object({ number: texto, title: texto, description: texto, color: cor })),
	faq: z.array(z.object({ question: texto, answer: texto })),
	boardgamePasses: z.object({
		afternoon: z.object({
			title: texto,
			days: texto,
			hours: texto,
			note: z.string(),
			tiers: z
				.array(
					z.object({
						id: z.enum(['leves', 'medios', 'grandes']),
						name: texto,
						price: texto,
						description: z.string(),
						color: cor,
						icon: z.string(),
					}),
				)
				.min(1),
		}),
		thursday: passe,
		saturday: passe,
		hourly: passe,
	}),
	boardgames: z.array(
		z.object({
			id: z.string().regex(/^[a-z0-9-]+$/),
			name: texto,
			category: z.enum(['leves', 'medios', 'grandes']),
			image: z.string(),
			players: z.string(),
			tag: z.string(),
			publisher: z.string(),
		}),
	),
	shop: z.object({
		seoTitle: texto,
		seoDescription: texto,
		titleLine: texto,
		titleHighlight: z.string(),
		orderOnSite: z.object({ lead: texto, cartHint: z.string() }),
		orderOnWhatsapp: z.object({ lead: texto, cartHint: z.string() }),
		emptyCatalog: texto,
	}),
	banners: z
		.array(
			z.object({
				title: texto,
				active: z.boolean(),
				placement: z.array(z.enum(['loja', 'inicio'])).min(1),
				startDate: dataCms.optional().or(z.literal('')),
				endDate: dataCms.optional().or(z.literal('')),
				link: z.string().optional(),
				cta: z.string().optional(),
				interval: z.number().int().min(3).max(20).optional(),
				slides: z.array(z.object({ src: texto, alt: z.string() })).min(1),
			}),
		)
		.default([]),
});

export type SiteContent = z.infer<typeof siteSchema>;

function carregar(): SiteContent {
	const r = siteSchema.safeParse(bruto);
	if (r.success) return r.data;
	const erros = r.error.issues.map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`).join('\n');
	throw new Error(`src/data/site.json não confere com o schema (src/lib/content.ts):\n${erros}`);
}

export const site = carregar();
