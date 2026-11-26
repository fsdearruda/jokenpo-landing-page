#!/usr/bin/env node
/**
 * Contrato da sincronização com o PDV: o PDV é o dono, o site guarda uma cópia idêntica.
 *
 *   pnpm sync:contract            copia do repositório do PDV (PDV_REPO_DIR no .env.local, padrão ../jokenpo-pdv)
 *   pnpm sync:contract --check    confere a cópia com contract.lock.json (roda no `pnpm check`)
 *   pnpm sync:contract --remote   confere a cópia com o `main` do PDV no GitHub (CI; precisa de
 *                                 PDV_CONTRACT_TOKEN com leitura do repositório do PDV)
 *
 * Arquivos copiados: src/lib/site-sync.ts → src/lib/pdv/sync.ts e contract-fixtures/ (exemplos de
 * mensagens que os testes leem). Nunca edite a cópia: mude no PDV e rode `pnpm sync:contract`.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PDV_GITHUB = 'larissarruda/jokenpo-pdv';
const LOCK = 'contract.lock.json';
const FIXTURES = 'contract-fixtures';
/** Caminho no PDV → caminho no site. */
const CONTRATO = { 'src/lib/site-sync.ts': 'src/lib/pdv/sync.ts' };

const sha = (text) => createHash('sha256').update(text).digest('hex');
const modo = process.argv[2] ?? '--copy';

// .env.local primeiro: loadEnvFile não sobrescreve o que já foi definido
for (const arquivo of ['.env.local', '.env']) {
	try {
		process.loadEnvFile(arquivo);
	} catch {
		/* arquivo ausente */
	}
}

/** Lista [caminho no PDV, caminho no site] de tudo que faz parte do contrato. */
function arquivos(pdvFixtures) {
	return [
		...Object.entries(CONTRATO),
		...pdvFixtures.map((nome) => [`${FIXTURES}/${nome}`, `${FIXTURES}/${nome}`]),
	];
}

function copiar() {
	const origem = resolve(process.env.PDV_REPO_DIR ?? '../jokenpo-pdv');
	if (!existsSync(join(origem, 'src/lib/site-sync.ts'))) {
		console.error(`PDV não encontrado em ${origem}. Defina PDV_REPO_DIR (no .env ou no comando).`);
		process.exit(1);
	}
	mkdirSync(FIXTURES, { recursive: true });
	// Commit do PDV de onde a cópia saiu (com "+alterado" se havia mudança não commitada no contrato)
	const git = (...args) => execFileSync('git', ['-C', origem, ...args], { encoding: 'utf8' }).trim();
	let commit = null;
	try {
		commit = git('rev-parse', 'HEAD');
		if (git('status', '--porcelain', '--', 'src/lib/site-sync.ts', FIXTURES)) commit += '+alterado';
	} catch {
		/* PDV fora de um repositório git */
	}
	const lock = { origem: PDV_GITHUB, commit, arquivos: {} };
	for (const [de, para] of arquivos(readdirSync(join(origem, FIXTURES)))) {
		const texto = readFileSync(join(origem, de), 'utf8');
		writeFileSync(para, texto);
		lock.arquivos[para] = sha(texto);
	}
	writeFileSync(LOCK, `${JSON.stringify(lock, null, '\t')}\n`);
	console.log(`Contrato copiado de ${origem} (${Object.keys(lock.arquivos).length} arquivos).`);
}

function conferirLocal() {
	if (!existsSync(LOCK)) {
		console.error(`${LOCK} não existe. Rode \`pnpm sync:contract\`.`);
		process.exit(1);
	}
	const { arquivos: esperados } = JSON.parse(readFileSync(LOCK, 'utf8'));
	const errados = Object.entries(esperados).filter(([caminho, hash]) => !existsSync(caminho) || sha(readFileSync(caminho, 'utf8')) !== hash);
	if (errados.length) {
		console.error(`Cópia do contrato editada à mão: ${errados.map(([c]) => c).join(', ')}.\nMude no PDV e rode \`pnpm sync:contract\`.`);
		process.exit(1);
	}
	console.log('Contrato do PDV: cópia confere com o lock.');
}

async function conferirRemoto() {
	const token = process.env.PDV_CONTRACT_TOKEN;
	if (!token) {
		console.error('PDV_CONTRACT_TOKEN não definido.');
		process.exit(1);
	}
	const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'jokenpo-contract-check' };
	// O GitHub responde 404 tanto para "sem acesso" quanto para "arquivo não existe": confere o acesso antes
	const repo = await fetch(`https://api.github.com/repos/${PDV_GITHUB}`, { headers });
	if (!repo.ok) {
		console.error(`PDV_CONTRACT_TOKEN sem acesso a ${PDV_GITHUB} (HTTP ${repo.status}). Token vencido ou sem permissão de leitura em Contents.`);
		process.exit(1);
	}
	const api = (caminho, accept) =>
		fetch(`https://api.github.com/repos/${PDV_GITHUB}/contents/${caminho}?ref=main`, { headers: { ...headers, Accept: accept } }).then((r) => {
			if (r.status === 404) return null;
			if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status}`);
			return accept.endsWith('raw') ? r.text() : r.json();
		});
	const lista = await api(FIXTURES, 'application/vnd.github+json');
	if (!lista) {
		console.error(`${FIXTURES}/ não existe no main do PDV: o contrato novo ainda não entrou lá.`);
		process.exit(1);
	}
	const diferentes = [];
	for (const [de, para] of arquivos(lista.map((f) => f.name))) {
		const remoto = await api(de, 'application/vnd.github.raw');
		if (remoto === null || !existsSync(para) || readFileSync(para, 'utf8') !== remoto) diferentes.push(para);
	}
	if (diferentes.length) {
		console.error(`O contrato mudou no PDV (main): ${diferentes.join(', ')}.\nRode \`pnpm sync:contract\` e ajuste o site.`);
		process.exit(1);
	}
	console.log('Contrato do PDV: igual ao main do PDV.');
}

if (modo === '--check') conferirLocal();
else if (modo === '--remote') await conferirRemoto();
else copiar();
