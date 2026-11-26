import type { APIRoute } from 'astro';
import { guardarFoto } from '../../../lib/pdv/fotos';
import { lerRequisicaoDoPdv, parse, syncError, respostaSync } from '../../../lib/pdv/sync-auth';
import { lerEnvioFoto } from '../../../lib/pdv/sync';

export const prerender = false;

/** Foto de produto enviada pelo PC da loja: guarda no Vercel Blob e devolve a URL pública. */
export const POST: APIRoute = async ({ request }) => {
	const lido = await lerRequisicaoDoPdv(request);
	if (lido instanceof Response) return lido;
	const foto = lerEnvioFoto(parse(lido.corpo));
	if (!foto) return respostaSync({ erro: { codigo: 'FORMATO_INVALIDO', mensagem: 'Foto em formato inválido.' } }, 400);
	try {
		const url = await guardarFoto(foto);
		if (!url) return respostaSync({ erro: { codigo: 'IMAGEM_INVALIDA', mensagem: 'O arquivo não é a imagem informada.' } }, 400);
		return respostaSync({ url });
	} catch (error) {
		return syncError(error);
	}
};
