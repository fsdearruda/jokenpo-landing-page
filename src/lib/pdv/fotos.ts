import { del, put } from '@vercel/blob';
import type { EnvioFoto } from './sync';

/**
 * Fotos de produto vindas do PDV, guardadas no Vercel Blob (store `jokenpo-fotos`, público, gru1).
 * Uma pasta por ambiente: o PDV de testes contra um preview nunca mexe nas fotos de produção.
 */
const pasta = () => process.env.VERCEL_ENV ?? 'dev';

const ASSINATURAS: Record<EnvioFoto['tipo'], (b: Buffer) => boolean> = {
	'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
	'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
	'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
};
const EXTENSAO: Record<EnvioFoto['tipo'], string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** Grava a foto e devolve a URL pública. `null` = o conteúdo não é a imagem que diz ser. */
export async function guardarFoto(foto: EnvioFoto): Promise<string | null> {
	const bytes = Buffer.from(foto.dados, 'base64');
	if (!bytes.length || !ASSINATURAS[foto.tipo](bytes)) return null;
	const { url } = await put(`${pasta()}/produtos/${foto.produtoId}/${foto.fotoId}.${EXTENSAO[foto.tipo]}`, bytes, {
		access: 'public',
		contentType: foto.tipo,
		addRandomSuffix: false,
		allowOverwrite: true, // o PDV reenvia a mesma foto se a resposta se perder
		cacheControlMaxAge: 60 * 60 * 24 * 365,
	});
	return url;
}

/** Apaga fotos que saíram dos produtos. Só as do próprio store; erro só vai para o log. */
export async function apagarFotos(urls: string[]) {
	const nossas = urls.filter((u) => /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(u));
	if (!nossas.length) return;
	try {
		await del(nossas);
	} catch (error) {
		console.error('[pdv-sync] não deu para apagar fotos antigas', error instanceof Error ? error.message : error);
	}
}
