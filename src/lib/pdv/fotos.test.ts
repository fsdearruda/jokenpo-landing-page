import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { guardarFoto } from './fotos';
import { lerEnvioFoto } from './sync';

const exemplo = lerEnvioFoto(JSON.parse(readFileSync(new URL('../../../contract-fixtures/envio-foto.json', import.meta.url), 'utf8')))!;

describe('foto enviada pelo PDV', () => {
	it('recusa arquivo que não é a imagem informada (sem gravar nada)', async () => {
		const falsa = { ...exemplo, dados: Buffer.from('<script>alert(1)</script>').toString('base64') };
		expect(await guardarFoto(falsa)).toBeNull();
		expect(await guardarFoto({ ...exemplo, tipo: 'image/png' })).toBeNull();
	});
});
