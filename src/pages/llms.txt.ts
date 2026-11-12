import type { APIRoute } from 'astro';
import siteData from '../data/site.json';

export const prerender = true;

export const GET: APIRoute = () => {
	const siteUrl = import.meta.env.PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://jokenpo.cards';
	const { name, description, location, contact, hours, agenda, boardgamePasses, boardgames, extras, faq } =
		siteData;

	const whatsappUrl = `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`;

	const lines: string[] = [
		`# ${name}`,
		'',
		`> ${description}`,
		'',
		'Espaço geek para a comunidade de Natal/RN com card games (Magic: The Gathering, Pokémon TCG, Yu-Gi-Oh!, One Piece), acervo de jogos de tabuleiro, ludoteca, torneios semanais e reserva de mesas.',
		'',
		'## Seções e Links Principais',
		`- [Página Principal](${siteUrl}/): Apresentação da loja, destaques da comunidade e chamadas de ação.`,
		`- [Como Funciona](${siteUrl}/#como-funciona): Passo a passo simples para quem vai jogar na loja pela primeira vez.`,
		`- [Tabela de Passes e Jogos](${siteUrl}/#jogar): Tabela de preços do Passe da Tarde, Dia do Boardgame, Passe de Sábado e Pegue e Jogue por hora.`,
		`- [Agenda de Torneios](${siteUrl}/#agenda): Programação semanal com torneios de Pokémon, Magic, Yu-Gi-Oh!, One Piece e boardgames.`,
		`- [Card Games e Comunidade](${siteUrl}/#sobre): Informações sobre os card games suportados, produtos lacrados e cartas avulsas.`,
		`- [Dúvidas Frequentes](${siteUrl}/#duvidas): Respostas sobre decks próprios, como jogar sem grupo e reservas.`,
		`- [Localização e Horários](${siteUrl}/#visite): Endereço no Shopping New Way Center, horários de funcionamento e mapa.`,
		`- [Google Maps da Loja](${location.mapsUrl}): Traçar rota no Google Maps até a loja 24 do Shopping New Way Center.`,
		`- [Comunidade Oficial no WhatsApp](${contact.communityWhatsapp}): Grupo de jogadores para combinar partidas e avisos de torneios.`,
		`- [WhatsApp Direto da Loja](${whatsappUrl}): Canal direto para dúvidas de balcão e reservas de mesa.`,
		`- [Instagram Oficial @jokenpoficial](${contact.instagram}): Atualizações, fotos de eventos e avisos gerais.`,
		`- [Sitemap XML](${siteUrl}/sitemap.xml): Mapa estruturado de URLs do site.`,
		'',
		'## Localização e Contato',
		`- Endereço: ${location.venue} — ${location.street}, ${location.neighborhood}, CEP ${location.postalCode}`,
		`- Horário de funcionamento: ${hours.map((h) => `${h.day}: ${h.open}`).join(' | ')}`,
		`- E-mail: ${contact.email}`,
		...(contact.cnpj ? [`- CNPJ: ${contact.cnpj}`] : []),
		'',
		'## Agenda Semanal de Eventos',
		...agenda.map((item) => `- ${item.day} — ${item.name}: ${item.detail}`),
		'',
		'## Passes e Aluguel de Jogos de Tabuleiro',
		`- ${boardgamePasses.afternoon.title} (${boardgamePasses.afternoon.days}, ${boardgamePasses.afternoon.hours}, ${boardgamePasses.afternoon.note}):`,
		...boardgamePasses.afternoon.tiers.map(
			(t) => `  - ${t.name}: ${t.price} (${t.description})`,
		),
		`- ${boardgamePasses.thursday.title} (${boardgamePasses.thursday.schedule}): ${boardgamePasses.thursday.price} (${boardgamePasses.thursday.note})`,
		`- ${boardgamePasses.saturday.title} (${boardgamePasses.saturday.schedule}): ${boardgamePasses.saturday.price} (${boardgamePasses.saturday.note})`,
		`- ${boardgamePasses.hourly.title} (${boardgamePasses.hourly.schedule}): R$ ${boardgamePasses.hourly.price} (${boardgamePasses.hourly.note})`,
		'',
		'## Acervo de Jogos Disponíveis',
		...boardgames.map(
			(g) => `- ${g.name} (${g.categoryName}, ${g.price}/h) — ${g.players} · ${g.tag} · Editora: ${g.publisher}`,
		),
		'',
		'## Estrutura e Serviços na Loja',
		...extras.map((e) => `- ${e.title}: ${e.description}`),
		'',
		'## Perguntas Frequentes (FAQ)',
		...faq.flatMap((f) => [`### ${f.question}`, f.answer, '']),
	];

	return new Response(lines.join('\n'), {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	});
};
