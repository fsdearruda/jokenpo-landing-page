#!/usr/bin/env node
/**
 * Gera `src/data/products.json` a partir do dump do PDV (banco `comanda`).
 *
 * Uso:
 *   pg_restore -f banco.sql banco.dump        # converte o dump custom em SQL
 *   node scripts/extract-products.mjs banco.sql
 *
 * Só lê as tabelas `Produto` e `Categoria` e só exporta campos públicos
 * (id, SKU, nome, preço e estoque). Custo, fornecedor e qualquer tabela com
 * dados pessoais (`Cliente`, `Usuario`, `EntradaEstoque`...) ficam de fora.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sqlPath = process.argv[2];
if (!sqlPath) {
	console.error('Uso: node scripts/extract-products.mjs <arquivo.sql gerado pelo pg_restore>');
	process.exit(1);
}

const sql = readFileSync(resolve(sqlPath), 'utf8');

/** Lê um bloco `COPY public."Tabela" (...) FROM stdin;` e devolve as linhas como objetos. */
function readCopy(table) {
	const header = new RegExp(`^COPY public\\."${table}" \\((.+)\\) FROM stdin;$`, 'm');
	const match = header.exec(sql);
	if (!match) throw new Error(`Tabela ${table} não encontrada no SQL.`);
	const columns = match[1].split(', ').map((c) => c.replaceAll('"', ''));
	const start = match.index + match[0].length + 1;
	const end = sql.indexOf('\n\\.', start);
	return sql
		.slice(start, end)
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => {
			const values = line.split('\t');
			return Object.fromEntries(columns.map((col, i) => [col, values[i] === '\\N' ? null : values[i]]));
		});
}

const produtos = readCopy('Produto').filter((p) => p.ativo === 't' && p.excluidoEm === null);

/**
 * Nomes de vitrine diferentes do cadastro do PDV, por `Produto.id`.
 * O PDV continua com o nome original; o site mostra este.
 */
const labelOverrides = {
	cmw3sqnrz001tm2sk9mafrrox: 'Completa', // PDV: "Deck box dupla"
};

/**
 * Famílias exibidas em /produtos. `category` é o título da seção na vitrine, `match` decide quais produtos do PDV entram
 * `label` dá o nome curto da variação e `title` o nome do card.
 */
const families = [
	{
		slug: 'shield-100',
		type: 'shield',
		name: 'Shield',
		category: 'Shields',
		subtitle: 'Pacote com 100 unidades',
		description: 'Protetor de cartas pra deixar o deck pronto pras partidas e torneios.',
		variantLabel: 'Cor',
		match: (p) => /^shield (preto|roxo) \(100 un\)$/i.test(p.nome),
		label: (p) => /preto/i.test(p.nome) ? 'Preto' : 'Roxo',
		swatch: (p) => /preto/i.test(p.nome) ? 'black' : 'purple',
		title: (label) => `Shield ${label.toLowerCase()} · 100 un`,
	},
	{
		slug: 'shield-personalizada',
		type: 'shield',
		name: 'Shield personalizada',
		category: 'Shields personalizados',
		subtitle: 'Com estampa',
		description: 'Protetor de cartas com estampa. Escolha o tamanho do pacote.',
		variantLabel: 'Pacote',
		match: (p) => /^shield personalizada/i.test(p.nome),
		label: (p) => `${p.nome.match(/\((\d+) un\)/i)?.[1]} un`,
		title: (label) => `Shield personalizada · ${label}`,
	},
	{
		slug: 'deck-box',
		type: 'deckbox',
		name: 'Deck box',
		category: 'Deck boxes',
		subtitle: 'Caixa para guardar o deck',
		description: 'Leve o deck protegido na mochila. Três modelos no balcão.',
		variantLabel: 'Modelo',
		match: (p) => /^deck box/i.test(p.nome),
		label: (p) => p.nome.replace(/^deck box\s*/i, '').replace(/^./, (c) => c.toUpperCase()),
		title: (label) => `Deck box ${label.toLowerCase()}`,
	},
	{
		slug: 'triple-pack-pokemon',
		type: 'triple',
		name: 'Triple pack Pokémon',
		category: 'Triple packs Pokémon',
		subtitle: 'Três boosters lacrados',
		description: 'Blister com três boosters de Pokémon TCG. Escolha a coleção.',
		variantLabel: 'Coleção',
		match: (p) => /triplo pack/i.test(p.nome),
		label: (p) => p.nome.split(' – ')[1] ?? p.nome,
		title: (label) => `Triple pack ${label}`,
	},
];

const output = {
	source: 'Dump do PDV (banco comanda), tabelas Produto e Categoria',
	extractedAt: new Date().toLocaleDateString('sv-SE'),
	families: families.map(({ match, label, swatch, title, ...family }) => ({
		...family,
		variants: produtos
			.filter(match)
			.sort((a, b) => Number(a.precoCentavos) - Number(b.precoCentavos) || a.nome.localeCompare(b.nome, 'pt-BR'))
			.map((p) => ({ p, label: labelOverrides[p.id] ?? label(p) }))
			.map(({ p, label: variantLabel }) => ({
				id: p.id,
				sku: p.sku,
				label: variantLabel,
				title: title(variantLabel),
				pdvName: p.nome,
				priceCents: Number(p.precoCentavos),
				stock: Math.max(0, Number(p.estoque) - Number(p.estoqueReservado)),
				...(swatch ? { swatch: swatch(p) } : {}),
			})),
	})),
};

const empty = output.families.filter((f) => f.variants.length === 0).map((f) => f.slug);
if (empty.length) console.warn(`Aviso: famílias sem produtos ativos: ${empty.join(', ')}`);

const target = resolve('src/data/products.json');
writeFileSync(target, `${JSON.stringify(output, null, '\t')}\n`);
console.log(`${output.families.reduce((n, f) => n + f.variants.length, 0)} variações gravadas em ${target}`);
