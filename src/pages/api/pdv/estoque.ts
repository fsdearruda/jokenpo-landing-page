import type { APIRoute } from 'astro';
import { handle } from '../../../lib/pdv';

export const prerender = false;

/** GET /api/pdv/estoque — disponível por `Produto.id`. */
export const GET: APIRoute = () => handle((pdv) => pdv.listarEstoque());
