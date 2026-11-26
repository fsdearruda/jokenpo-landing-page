/** Substitui `astro:env/server` nos testes de integração: lê do process.env. */
export const getSecret = (nome: string): string | undefined => process.env[nome] || undefined;
export const PEDIDOS_NO_SITE = true;
