import type { APIRoute } from 'astro';
import { handle } from '../../../../../lib/pdv';

export const prerender = false;

/** GET /api/pdv/pedidos/:id — status da reserva. O id é um UUID difícil de adivinhar. */
export const GET: APIRoute = ({ params }) => handle((pdv) => pdv.buscarPedido(params.id ?? ''));
