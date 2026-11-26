import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import { siteSchema } from './content';
import bruto from '../data/site.json';

type Campo = { name: string; widget?: string; fields?: Campo[]; field?: Campo };

/** Caminhos (a.b.c) dos campos que o CMS edita em site.json. */
function caminhosDoCms(): Set<string> {
	const config = parse(readFileSync('public/admin/config.yml', 'utf8')) as {
		collections: { files?: { file: string; fields: Campo[] }[] }[];
	};
	const caminhos = new Set<string>();
	const andar = (campos: Campo[], prefixo: string) => {
		for (const c of campos) {
			const caminho = prefixo ? `${prefixo}.${c.name}` : c.name;
			caminhos.add(caminho);
			if (c.fields) andar(c.fields, caminho);
		}
	};
	for (const col of config.collections) for (const f of col.files ?? []) if (f.file === 'src/data/site.json') andar(f.fields, '');
	return caminhos;
}

/** Caminhos do schema (objetos e listas de objetos). */
function caminhosDoSchema(): Set<string> {
	const caminhos = new Set<string>();
	const andar = (tipo: z.ZodType, prefixo: string) => {
		let t: z.ZodType = tipo;
		// desembrulha optional/default/array até chegar no objeto
		for (;;) {
			if (t instanceof z.ZodOptional || t instanceof z.ZodDefault) t = t.unwrap() as z.ZodType;
			else if (t instanceof z.ZodArray) t = t.element as z.ZodType;
			else break;
		}
		if (!(t instanceof z.ZodObject)) return;
		for (const [nome, filho] of Object.entries(t.shape)) {
			const caminho = prefixo ? `${prefixo}.${nome}` : nome;
			caminhos.add(caminho);
			andar(filho as z.ZodType, caminho);
		}
	};
	andar(siteSchema, '');
	return caminhos;
}

describe('conteúdo do site (site.json)', () => {
	it('confere com o schema', () => {
		expect(siteSchema.safeParse(bruto).error?.issues ?? []).toEqual([]);
	});
	it('o schema e o CMS têm os mesmos campos', () => {
		const cms = caminhosDoCms();
		const schema = caminhosDoSchema();
		expect([...schema].filter((c) => !cms.has(c)), 'no schema mas não no CMS').toEqual([]);
		expect([...cms].filter((c) => !schema.has(c)), 'no CMS mas não no schema').toEqual([]);
	});
	it('recusa conteúdo quebrado (ex.: cor fora das opções)', () => {
		const quebrado = structuredClone(bruto) as { agenda: { color: string }[] };
		quebrado.agenda[0].color = 'verde';
		expect(siteSchema.safeParse(quebrado).success).toBe(false);
	});
});
