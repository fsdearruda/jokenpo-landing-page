/**
 * Comportamento da /loja no navegador: sacola (localStorage `jokenpo:sacola`), filtros, pedido no site ou pelo
 * WhatsApp e acompanhamento do pedido. A página passa os dados pelos atributos `data-*` do `.shop`.
 */
import { initBotId } from 'botid/client/core';
import { formatPrice, pixPrice, type PaymentRules } from '../lib/catalog';

type Line = { id: string; qty: number };
type OrderStatus = 'AGUARDANDO_CONFIRMACAO' | 'PAGAMENTO_PENDENTE' | 'PAGO' | 'ENTREGUE' | 'RECUSADO' | 'CANCELADO' | 'EXPIRADO';
type SavedOrder = {
	id: string;
	numero: number;
	status: OrderStatus;
	itens: { descricao: string; quantidade: number; precoUnitarioCentavos?: number }[];
	totalCentavos: number;
	validoAte: string | null;
	motivo: string | null;
	/** Desconto no Pix gravado no pedido; ausente/null = pedido antigo, vale o da página. */
	descontoPixBp?: number | null;
};

const root = document.querySelector<HTMLElement>('.shop');
if (root) {
	const $ = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = root) =>
		scope.querySelector<T>(selector)!;
	const mode = root.dataset.pdvMode;
	// Pedido no site: o BotID (Vercel) marca o POST do pedido para a rota barrar robôs que seguram estoque
	if (root.dataset.orderApi) initBotId({ protect: [{ path: '/api/pdv/pedidos', method: 'POST' }] });
	const maxQty = Number(root.dataset.maxQty) || 5;
	const lowStock = Number(root.dataset.lowStock) || 3;
	const STORAGE_KEY = 'jokenpo:sacola';
	const ORDER_KEY = 'jokenpo:pedido';
	const optional = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector);
	const payment = JSON.parse(root.dataset.payment ?? '{}') as PaymentRules;
	/** Total do pedido no Pix: desconto sobre o preço de cada item gravado no pedido (o preço do PDV é o do cartão). */
	const orderPix = (o: SavedOrder) => {
		// O desconto do momento do pedido (gravado nele) vale mesmo que a loja mude o desconto depois
		const regras: PaymentRules = typeof o.descontoPixBp === 'number' ? { descontoPixBp: o.descontoPixBp } : payment;
		return o.itens.every((item) => item.precoUnitarioCentavos)
			? o.itens.reduce((sum, item) => sum + pixPrice(item.precoUnitarioCentavos!, regras) * item.quantidade, 0)
			: pixPrice(o.totalCentavos, regras);
	};
	/** Com desconto no Pix, o total vem nos dois meios. */
	const totalSentence = (pix: number, card: number) =>
		card > pix ? `${formatPrice(pix)} no Pix ou ${formatPrice(card)} no cartão` : formatPrice(card);

	const cards = new Map(
		[...root.querySelectorAll<HTMLElement>('.product-card')].map((card) => [card.dataset.id!, card]),
	);
	const cart = new Map<string, Line>();

	const cartEl = $('#sacola');
	const cartList = $<HTMLUListElement>('[data-role="cart-list"]');
	const cartEmpty = $('[data-role="cart-empty"]');
	const cartFoot = $('[data-role="cart-foot"]');
	const bar = $<HTMLButtonElement>('[data-role="cart-bar"]');
	const lineTpl = $<HTMLTemplateElement>('[data-role="line-template"]');
	const backdrop = $('[data-role="cart-backdrop"]');
	const announce = $('[data-role="announce"]');
	const drawerQuery = window.matchMedia('(max-width: 1023px)');

	const info = (id: string) => {
		const card = cards.get(id)!;
		return {
			title: card.dataset.title ?? '',
			price: Number(card.dataset.price),
			stock: Number(card.dataset.stock),
		};
	};
	const limit = (id: string) => Math.max(0, Math.min(info(id).stock, maxQty));
	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	const totals = () => {
		let items = 0;
		let cents = 0;
		let card = 0;
		cart.forEach((line) => {
			const { price } = info(line.id);
			items += line.qty;
			cents += line.qty * pixPrice(price, payment); // total no Pix (o que aparece primeiro)
			card += line.qty * price; // o preço do PDV é o do cartão
		});
		return { items, cents, card };
	};

	/* Persistência local: a sacola sobrevive a um recarregamento. */
	const save = () => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([...cart.values()]));
		} catch {
			/* Navegação privada ou armazenamento bloqueado. */
		}
	};
	const restore = () => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Line[];
			saved.forEach((line) => {
				if (cards.has(line.id) && Number.isInteger(line.qty) && line.qty > 0) {
					const qty = Math.min(line.qty, limit(line.id));
					if (qty > 0) cart.set(line.id, { id: line.id, qty });
				}
			});
		} catch {
			/* Ignora dado corrompido. */
		}
	};

	const pulseBar = () => {
		bar.classList.remove('is-pulse');
		void bar.offsetWidth;
		bar.classList.add('is-pulse');
	};

	/* Quantidade: um único ponto de mudança para card e sacola. */
	const setQty = (id: string, qty: number, origin: 'card' | 'cart') => {
		const { title } = info(id);
		const next = Math.max(0, Math.min(qty, limit(id)));
		const before = cart.get(id)?.qty ?? 0;
		if (next === 0) cart.delete(id);
		else cart.set(id, { id, qty: next });
		const sent = optional('[data-role="cart-sent"]');
		if (sent) sent.hidden = true;
		render();
		save();
		if (next === before && qty > before) announce.textContent = `Limite de ${plural(next, 'unidade', 'unidades')} de ${title}.`;
		else if (next === 0) announce.textContent = `${title} saiu da sacola.`;
		else announce.textContent = `${title}: ${next} na sacola. Total ${formatPrice(totals().cents)}.`;
		if (origin === 'card' && before === 0 && next > 0) pulseBar();
	};

	/* Cards */
	const syncCard = (card: HTMLElement) => {
		const id = card.dataset.id!;
		const stock = Number(card.dataset.stock);
		const qty = cart.get(id)?.qty ?? 0;
		const level = stock <= 0 ? 'out' : stock <= lowStock ? 'low' : 'ok';
		const add = $<HTMLButtonElement>('[data-role="add"]', card);
		const qtyBox = $('[data-role="qty"]', card);
		const stockEl = $('[data-role="stock"]', card);
		card.classList.toggle('is-in-cart', qty > 0);
		add.hidden = qty > 0;
		add.disabled = level === 'out';
		add.textContent = level === 'out' ? 'Esgotado' : 'Adicionar';
		qtyBox.hidden = qty === 0;
		$('[data-role="qty-value"]', card).textContent = `${qty} na sacola`;
		$<HTMLButtonElement>('[data-step="1"]', card).disabled = qty >= limit(id);
		stockEl.dataset.level = level;
		stockEl.textContent = { out: 'Esgotado', low: 'Últimas unidades', ok: 'Em estoque' }[level];
	};

	cards.forEach((card, id) => {
		$('[data-role="add"]', card).addEventListener('click', () => {
			setQty(id, 1, 'card');
			const plus = $<HTMLButtonElement>('[data-step="1"]', card);
			(plus.disabled ? $<HTMLButtonElement>('[data-step="-1"]', card) : plus).focus();
		});
		card.querySelectorAll<HTMLButtonElement>('.step-btn').forEach((button) => {
			button.addEventListener('click', () => {
				const next = (cart.get(id)?.qty ?? 0) + Number(button.dataset.step);
				setQty(id, next, 'card');
				if (next === 0) $<HTMLButtonElement>('[data-role="add"]', card).focus();
				else if (button.disabled) $<HTMLButtonElement>('[data-step="-1"]', card).focus();
			});
		});
	});

	/* Sacola */
	const lineTemplate = (line: Line) => {
		const { title, price } = info(line.id);
		const li = lineTpl.content.firstElementChild!.cloneNode(true) as HTMLLIElement;
		li.dataset.id = line.id;
		li.querySelector('.line-name')!.textContent = title;
		li.querySelector('.line-unit')!.textContent = `${formatPrice(price)} cada`;
		li.querySelector('.line-qty')!.setAttribute('aria-label', `Quantidade de ${title}`);
		li.querySelector('.line-qty-value')!.textContent = String(line.qty);
		li.querySelector('.line-price')!.textContent = formatPrice(price * line.qty);
		const [minus, plus] = li.querySelectorAll<HTMLButtonElement>('.step-btn');
		minus.setAttribute('aria-label', `Tirar uma unidade de ${title}`);
		plus.setAttribute('aria-label', `Adicionar mais uma unidade de ${title}`);
		plus.disabled = line.qty >= limit(line.id);
		minus.addEventListener('click', () => {
			setQty(line.id, line.qty - 1, 'cart');
			focusLine(line.id, '[data-step="-1"]');
		});
		plus.addEventListener('click', () => {
			setQty(line.id, line.qty + 1, 'cart');
			focusLine(line.id, '[data-step="1"]');
		});
		const remove = li.querySelector<HTMLButtonElement>('.line-remove')!;
		remove.setAttribute('aria-label', `Remover ${title} da sacola`);
		remove.addEventListener('click', () => {
			setQty(line.id, 0, 'cart');
			focusLine(line.id, '.line-remove');
		});
		return li;
	};

	/** Mantém o foco no mesmo controle depois de redesenhar; se a linha sumiu, vai para o título. */
	const focusLine = (id: string, selector: string) => {
		const li = cartList.querySelector<HTMLElement>(`[data-id="${id}"]`);
		const target = li?.querySelector<HTMLButtonElement>(selector);
		if (target && !target.disabled) target.focus();
		else (li?.querySelector<HTMLButtonElement>('.line-remove') ?? $('#cart-heading')).focus();
	};

	/** Mensagem pronta pro WhatsApp da loja, no tom da marca e sem emoji. */
	function orderMessage(cents: number, card: number) {
		const lines = [...cart.values()].map((line) => {
			const { title, price } = info(line.id);
			const unit = line.qty > 1 ? ` (${formatPrice(price)} cada)` : '';
			return `${line.qty}x ${title}${unit} = ${formatPrice(price * line.qty)}`;
		});
		return [
			'Oi, Jokenpo! Quero fazer um pedido pra retirar na loja:',
			'',
			...lines,
			'',
			`Total: ${totalSentence(cents, card)}`,
			'',
			'Pode separar pra mim?',
		].join('\n');
	}

	function render() {
		const { items, cents, card } = totals();
		const empty = cart.size === 0;
		const cardLine = optional('[data-role="cart-card"]');
		if (cardLine) {
			cardLine.hidden = card <= cents;
			cardLine.replaceChildren('no Pix · ou ', Object.assign(document.createElement('strong'), { textContent: formatPrice(card) }), ' no cartão');
		}
		cartList.replaceChildren(...[...cart.values()].map(lineTemplate));
		cartEmpty.hidden = !empty || Boolean(order); // com pedido aberto, o painel do pedido ocupa o lugar
		cartFoot.hidden = empty;
		$('[data-role="cart-count"]').textContent = empty ? '' : `(${items})`;
		$('[data-role="cart-total"]').textContent = formatPrice(cents);
		$('[data-role="cart-items"]').textContent = empty ? '' : plural(items, 'item', 'itens');
		$('[data-role="bar-count"]').textContent = String(items);
		$('[data-role="bar-total"]').textContent = formatPrice(cents);
		bar.setAttribute('aria-label', `Ver sacola: ${plural(items, 'item', 'itens')}, ${formatPrice(cents)}`);
		bar.hidden = empty && !order;
		if (empty && order) {
			$('[data-role="bar-count"]').textContent = `#${order.numero}`;
			$('[data-role="bar-total"]').textContent = formatPrice(order.totalCentavos);
			bar.querySelector('.cart-bar-label')!.textContent = 'Ver pedido';
			bar.setAttribute('aria-label', `Ver pedido número ${order.numero}`);
		} else {
			bar.querySelector('.cart-bar-label')!.textContent = 'Ver sacola';
		}
		cards.forEach(syncCard);
		const message = optional('[data-role="message"]');
		const link = optional<HTMLAnchorElement>('[data-role="whatsapp-link"]');
		if (message && link) {
			const text = orderMessage(cents, card);
			message.textContent = text;
			link.href = `https://wa.me/${root!.dataset.whatsapp}?text=${encodeURIComponent(text)}`;
		}
	}

	/* Gaveta no celular, coluna fixa no desktop */
	let drawerOpen = false;
	const syncDrawer = () => {
		const isDrawer = drawerQuery.matches;
		const open = isDrawer && drawerOpen;
		cartEl.classList.toggle('is-open', open);
		cartEl.inert = isDrawer && !drawerOpen;
		backdrop.hidden = !open;
		bar.setAttribute('aria-expanded', String(open));
		document.documentElement.classList.toggle('cart-locked', open);
		if (open) {
			cartEl.setAttribute('role', 'dialog');
			cartEl.setAttribute('aria-modal', 'true');
		} else {
			cartEl.removeAttribute('role');
			cartEl.removeAttribute('aria-modal');
		}
	};
	const openDrawer = () => {
		drawerOpen = true;
		syncDrawer();
		$<HTMLButtonElement>('[data-role="cart-close"]').focus();
	};
	const closeDrawer = () => {
		if (!drawerOpen) return;
		drawerOpen = false;
		syncDrawer();
		if (!bar.hidden) bar.focus();
	};
	bar.addEventListener('click', openDrawer);
	backdrop.addEventListener('click', closeDrawer);
	$('[data-role="cart-close"]').addEventListener('click', closeDrawer);
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') closeDrawer();
	});
	drawerQuery.addEventListener('change', () => {
		drawerOpen = false;
		syncDrawer();
	});

	/* Filtro por categoria e, nas cartas avulsas, por jogo, coleção, condição e idioma */
	const filterButtons = [...root.querySelectorAll<HTMLButtonElement>('.filter-btn')];
	const cartaSelects = [...root.querySelectorAll<HTMLSelectElement>('[data-carta-filtro]')];
	let category = 'all';
	const applyFilters = () => {
		const carta = cartaSelects.filter((s) => s.value).map((s) => [s.dataset.cartaFiltro!, s.value] as const);
		let visible = 0;
		root.querySelectorAll<HTMLElement>('.product-grid > li').forEach((item) => {
			// Com filtro de carta ativo, produto que não é carta sai da lista
			const show =
				(category === 'all' || item.dataset.category === category) &&
				carta.every(([campo, valor]) => item.dataset[campo] === valor);
			item.hidden = !show;
			if (show) visible += 1;
		});
		$('#filter-status').textContent = `Mostrando ${plural(visible, 'produto', 'produtos')}.`;
	};
	filterButtons.forEach((button) => {
		button.addEventListener('click', () => {
			category = button.dataset.filter ?? 'all';
			filterButtons.forEach((b) => {
				b.classList.toggle('is-active', b === button);
				b.setAttribute('aria-pressed', String(b === button));
			});
			applyFilters();
		});
	});
	cartaSelects.forEach((select) => select.addEventListener('change', applyFilters));

	/** Redesenha o bloco de preço quando o PDV manda um preço novo. */
	const paintPrice = (card: HTMLElement) => {
		const price = Number(card.dataset.price);
		const before = Number(card.dataset.compare) || 0;
		const beforeEl = $('[data-role="price-before"]', card);
		beforeEl.hidden = before <= price;
		const beforeText = beforeEl.querySelector('s');
		if (beforeText && before > price) beforeText.textContent = formatPrice(pixPrice(before, payment));
		$('[data-role="price-pix"]', card).textContent = formatPrice(pixPrice(price, payment));
		const cardEl = card.querySelector('[data-role="price-card"]');
		if (cardEl) cardEl.textContent = formatPrice(price);
	};

	const refreshStock = async () => {
		try {
			const response = await fetch('/api/pdv/estoque', { headers: { accept: 'application/json' } });
			if (!response.ok) return;
			const items = (await response.json()) as { produtoId: string; disponivel: number; precoCentavos?: number }[];
			const seen = new Set<string>();
			items.forEach(({ produtoId, disponivel, precoCentavos }) => {
				const card = cards.get(produtoId);
				if (!card) return;
				seen.add(produtoId);
				card.dataset.stock = String(disponivel);
				if (precoCentavos && precoCentavos !== Number(card.dataset.price)) {
					card.dataset.price = String(precoCentavos);
					paintPrice(card);
				}
			});
			// Produto que saiu do catálogo no PDV fica como esgotado até a página recarregar
			if (mode === 'live') cards.forEach((card, id) => !seen.has(id) && (card.dataset.stock = '0'));
			cart.forEach((line) => {
				const max = limit(line.id);
				if (max === 0) cart.delete(line.id);
				else if (line.qty > max) line.qty = max;
			});
			render();
			save();
		} catch {
			/* Mantém o estoque estático da página. */
		}
	};

	/* Envio pelo WhatsApp (modo sem PDV): a sacola fica até o cliente esvaziar, caso precise reenviar. */
	optional('[data-role="whatsapp-link"]')?.addEventListener('click', () => {
		$('[data-role="cart-sent"]').hidden = false;
	});
	optional('[data-role="cart-clear"]')?.addEventListener('click', () => {
		cart.clear();
		save();
		render();
		$('[data-role="cart-sent"]').hidden = true;
		announce.textContent = 'Sacola esvaziada.';
		$('#cart-heading').focus();
	});

	/* Pedido pelo site (modo com PDV): a loja confirma o estoque e o pagamento é combinado no WhatsApp. */
	const ORDER_TEXT: Record<OrderStatus, (o: SavedOrder) => string> = {
		AGUARDANDO_CONFIRMACAO: () =>
			'Recebido! A loja confere o estoque assim que o sistema da loja estiver ligado e as unidades ficam guardadas pra você enquanto isso.',
		PAGAMENTO_PENDENTE: (o) =>
			`Separado! Pague por Pix no WhatsApp até ${deadline(o.validoAte)}. Depois disso as unidades voltam pra loja.`,
		PAGO: () => 'Pagamento recebido. É só passar na loja 24 pra retirar.',
		ENTREGUE: () => 'Entregue. Bom jogo!',
		RECUSADO: () => 'Esse não deu: algum item acabou antes de a loja confirmar. Chama a gente no WhatsApp que a gente vê uma alternativa.',
		CANCELADO: (o) => `A loja cancelou este pedido${o.motivo ? ` (${o.motivo})` : ''}.`,
		EXPIRADO: (o) =>
			o.motivo?.includes('não confirmou')
				? 'A loja não conseguiu confirmar a tempo e o pedido expirou. Se ainda quiser, é só pedir de novo.'
				: 'O prazo de 48 h pra pagar acabou e as unidades voltaram pra loja. Se ainda quiser, é só pedir de novo.',
	};
	const FINAL: OrderStatus[] = ['ENTREGUE', 'RECUSADO', 'CANCELADO', 'EXPIRADO'];
	let order: SavedOrder | null = null;
	let pollTimer: number | undefined;

	function deadline(iso: string | null) {
		if (!iso) return 'o prazo combinado';
		return new Intl.DateTimeFormat('pt-BR', {
			weekday: 'long',
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'America/Fortaleza',
		}).format(new Date(iso));
	}

	const saveOrder = () => {
		try {
			if (order) localStorage.setItem(ORDER_KEY, JSON.stringify(order));
			else localStorage.removeItem(ORDER_KEY);
		} catch {
			/* Armazenamento bloqueado: o pedido continua valendo, só não reaparece ao recarregar. */
		}
	};

	function renderOrder() {
		const panel = optional('[data-role="order-status"]');
		if (!panel) return;
		panel.hidden = !order;
		if (!order) return;
		$('[data-role="order-number"]', panel).textContent = String(order.numero);
		const state = $('[data-role="order-state"]', panel);
		state.dataset.state = order.status;
		state.textContent = ORDER_TEXT[order.status](order);
		$('[data-role="order-items"]', panel).replaceChildren(
			...order.itens.map((item) => {
				const li = document.createElement('li');
				li.textContent = `${item.quantidade}x ${item.descricao}`;
				return li;
			}),
			Object.assign(document.createElement('li'), { className: 'order-total', textContent: `Total ${totalSentence(orderPix(order), order.totalCentavos)}` }),
		);
		const text =
			order.status === 'RECUSADO'
				? `Oi, Jokenpo! O pedido #${order.numero} do site não tinha estoque. Tem alguma alternativa?`
				: `Oi, Jokenpo! Fiz o pedido #${order.numero} no site (total ${totalSentence(orderPix(order), order.totalCentavos)}). Como faço o pagamento?`;
		const whatsapp = $<HTMLAnchorElement>('[data-role="order-whatsapp"]', panel);
		whatsapp.href = `https://wa.me/${root!.dataset.whatsapp}?text=${encodeURIComponent(text)}`;
		whatsapp.hidden = order.status === 'PAGO' || order.status === 'ENTREGUE';
		$('[data-role="order-whatsapp-label"]', panel).textContent =
			order.status === 'RECUSADO' ? 'Falar com a loja' : 'Combinar o pagamento';
		$('[data-role="order-dismiss"]', panel).textContent = FINAL.includes(order.status) ? 'Fechar' : 'Fechar e fazer outro pedido';
	}

	async function pollOrder() {
		window.clearTimeout(pollTimer);
		if (!order || FINAL.includes(order.status)) return;
		if (document.visibilityState === 'visible') {
			try {
				const response = await fetch(`/api/pdv/pedidos/${order.id}`, { headers: { accept: 'application/json' } });
				if (response.status === 404) {
					order = null;
				} else if (response.ok) {
					const data = (await response.json()) as SavedOrder;
					const changed = data.status !== order.status;
					order = { ...order, status: data.status, validoAte: data.validoAte, motivo: data.motivo };
					if (changed) announce.textContent = `Pedido ${order.numero}: ${ORDER_TEXT[order.status](order)}`;
				}
				saveOrder();
				renderOrder();
				render();
			} catch {
				/* Sem rede: tenta de novo no próximo ciclo. */
			}
		}
		pollTimer = window.setTimeout(pollOrder, 20_000);
	}
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') void pollOrder();
	});

	const orderForm = optional<HTMLFormElement>('[data-role="order-form"]');
	if (orderForm) {
		const errorEl = $('[data-role="order-error"]', orderForm);
		const submit = $<HTMLButtonElement>('[data-role="order-submit"]', orderForm);
		const nameInput = $<HTMLInputElement>('#order-name', orderForm);
		const phoneInput = $<HTMLInputElement>('#order-phone', orderForm);
		const showError = (message: string, field?: HTMLInputElement) => {
			errorEl.textContent = message;
			errorEl.hidden = false;
			[nameInput, phoneInput].forEach((input) => input.toggleAttribute('aria-invalid', input === field));
			if (field) {
				field.setAttribute('aria-describedby', 'order-error');
				field.focus();
			}
		};
		errorEl.id = 'order-error';

		/* Máscara do WhatsApp: (84) 9 0000-0000 ou (84) 3333-4444, mantendo o cursor no lugar. */
		const formatPhone = (raw: string) => {
			let d = raw.replace(/\D/g, '');
			if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
			d = d.slice(0, 11);
			if (d.length === 0) return '';
			if (d.length <= 2) return `(${d}`;
			const ddd = `(${d.slice(0, 2)}) `;
			const rest = d.slice(2);
			// Celular começa com 9: já formata como (84) 9 0000-0000 enquanto digita
			if (rest[0] === '9') {
				const body = rest.slice(1);
				if (!body) return `${ddd}9`;
				return `${ddd}9 ${body.slice(0, 4)}${body.length > 4 ? `-${body.slice(4)}` : ''}`;
			}
			if (rest.length > 4) return `${ddd}${rest.slice(0, 4)}-${rest.slice(4)}`;
			return `${ddd}${rest}`;
		};
		// Apagar logo depois de um separador apaga o dígito anterior, senão a máscara devolve o separador
		phoneInput.addEventListener('beforeinput', (event) => {
			const { selectionStart: start, selectionEnd: end, value } = phoneInput;
			if (event.inputType !== 'deleteContentBackward' || start === null || start !== end || start === 0) return;
			if (/\d/.test(value[start - 1])) return;
			let i = start - 1;
			while (i >= 0 && !/\d/.test(value[i])) i--;
			if (i < 0) return;
			event.preventDefault();
			const digitsBefore = value.slice(0, i).replace(/\D/g, '').length;
			const formatted = formatPhone(value.slice(0, i) + value.slice(start));
			phoneInput.value = formatted;
			let pos = 0;
			for (let seen = 0; pos < formatted.length && seen < digitsBefore; pos++) if (/\d/.test(formatted[pos])) seen++;
			phoneInput.setSelectionRange(pos, pos);
		});
		phoneInput.addEventListener('input', () => {
			const caret = phoneInput.selectionStart ?? phoneInput.value.length;
			const digitsBefore = phoneInput.value.slice(0, caret).replace(/\D/g, '').length;
			const formatted = formatPhone(phoneInput.value);
			if (formatted === phoneInput.value) return;
			phoneInput.value = formatted;
			let pos = 0;
			for (let seen = 0; pos < formatted.length && seen < digitsBefore; pos++) if (/\d/.test(formatted[pos])) seen++;
			phoneInput.setSelectionRange(pos, pos);
		});

		orderForm.addEventListener('submit', async (event) => {
			event.preventDefault();
			errorEl.hidden = true;
			const nome = nameInput.value.trim();
			const telefone = formatPhone(phoneInput.value).replace(/\D/g, '');
			if (nome.length < 2) return showError('Coloca seu nome pra gente achar o pedido no balcão.', nameInput);
			if (telefone.length < 10) return showError('Coloca um WhatsApp com DDD, tipo (84) 9 0000-0000.', phoneInput);

			submit.disabled = true;
			submit.textContent = 'Enviando…';
			try {
				const response = await fetch('/api/pdv/pedidos', {
					method: 'POST',
					headers: { 'content-type': 'application/json', accept: 'application/json' },
					body: JSON.stringify({
						nomeContato: nome,
						telefoneContato: telefone,
						itens: [...cart.values()].map((line) => ({ produtoId: line.id, quantidade: line.qty })),
					}),
				});
				const data = await response.json().catch(() => null);
				if (!response.ok) {
					const erro = data?.erro as { codigo?: string; mensagem?: string; detalhes?: unknown } | undefined;
					if (erro?.codigo === 'ESTOQUE_INSUFICIENTE' || erro?.codigo === 'ITEM_INVALIDO') {
						// Atualiza o estoque dos itens que faltaram e ajusta a sacola
						if (Array.isArray(erro.detalhes)) {
							(erro.detalhes as { produtoId: string; disponivel: number }[]).forEach(({ produtoId, disponivel }) => {
								const card = cards.get(produtoId);
								if (card) card.dataset.stock = String(disponivel);
							});
							cart.forEach((line) => {
								const max = limit(line.id);
								if (max === 0) cart.delete(line.id);
								else if (line.qty > max) line.qty = max;
							});
							save();
							render();
						}
						return showError(`${erro.mensagem ?? 'Um item acabou.'} A sacola foi ajustada: confere e tenta de novo.`);
					}
					if (erro?.codigo === 'CONTATO_INVALIDO') return showError(erro.mensagem ?? 'Confere seu nome e WhatsApp.', phoneInput);
					if ((erro?.codigo === 'MUITAS_TENTATIVAS' || erro?.codigo === 'LIMITE_PEDIDOS' || erro?.codigo === 'LOJA_OFFLINE' || erro?.codigo === 'ACESSO_NEGADO') && erro.mensagem) return showError(erro.mensagem);
					return showError('Não deu pra enviar agora. Tenta de novo em instantes ou chama a gente no WhatsApp.');
				}
				const created = data as SavedOrder;
				order = {
					id: created.id,
					numero: created.numero,
					status: created.status,
					itens: created.itens,
					totalCentavos: created.totalCentavos,
					validoAte: created.validoAte,
					motivo: created.motivo,
					descontoPixBp: created.descontoPixBp ?? null,
				};
				saveOrder();
				cart.clear();
				save();
				orderForm.reset();
				render();
				renderOrder();
				$('#order-title').focus();
				void pollOrder();
			} catch {
				showError('Sem conexão. Confere sua internet e tenta de novo.');
			} finally {
				submit.disabled = false;
				submit.textContent = 'Fazer pedido';
			}
		});

		$('[data-role="order-dismiss"]').addEventListener('click', () => {
			window.clearTimeout(pollTimer);
			order = null;
			saveOrder();
			renderOrder();
			render();
			announce.textContent = 'Pedido fechado nesta tela. Ele continua valendo na loja.';
			$('#cart-heading').focus();
		});

		try {
			const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? 'null') as SavedOrder | null;
			if (saved && typeof saved.id === 'string' && Number.isInteger(saved.numero) && ORDER_TEXT[saved.status]) order = saved;
		} catch {
			/* Ignora dado corrompido. */
		}
	}

	// Com pedido no site, a vitrine atualiza estoque e preço ao vivo.
	if (mode === 'live') {
		const schedule = (cb: () => void) =>
			'requestIdleCallback' in window ? requestIdleCallback(cb) : setTimeout(cb, 300);
		schedule(() => void refreshStock());
	}

	restore();
	render();
	renderOrder();
	syncDrawer();
	// Vindo da página do produto (/loja#sacola): no celular a sacola é gaveta, então abre
	if (location.hash === '#sacola' && drawerQuery.matches) openDrawer();
	if (order) void pollOrder();
}
