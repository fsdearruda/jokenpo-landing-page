/** Endereço público do site, sem barra no fim (`PUBLIC_SITE_URL` no preview; padrão o domínio de produção). */
export const SITE_URL = (import.meta.env.PUBLIC_SITE_URL ?? 'https://jokenpo.cards').replace(/\/$/, '');
