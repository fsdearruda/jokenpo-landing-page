# Revisão contra "cara de IA"

Procure cada sinal no que você fez. Corrija trocando pelo padrão da Jokenpo, não por outro clichê.

## Sinais genéricos que nunca servem aqui

| Sinal | Troque por |
|---|---|
| Gradiente roxo/azul, fundo "aurora", glassmorphism com blur | Superfície sólida `--ink`/`--ink-2` ou bloco CMY chapado |
| Sombra cinza difusa + borda fina em card | Borda sólida de 2px + sombra dura (`--shadow-hard` / `--shadow-hard-surface`) |
| Grade de 3 cards iguais com ícone em quadradinho arredondado | Layout assimétrico, ticket, polaroid ou lista; ícone só se carregar informação |
| Mesmo raio em tudo | Tokens por papel: `--radius-card`, `--radius-feature`, `--radius-pill` |
| Inter/system-ui em tudo | Archivo Black (display) + Poppins (texto) na landing; fontes do `globals.css` no PDV |
| Texto cinza sobre fundo colorido | `--ink` ou `--ink-on-color` sobre amarelo/ciano/rosa |
| Hover que levanta todo card e fade-in em toda seção | Movimento só onde ajuda a entender; respeitar os tokens de duração |
| `→` em todo link, separador `·` em toda meta, "PALAVRA — fragmento" | Texto direto; ícone de seta só no componente que já usa `ArrowIcon` |
| Destacar uma palavra do título com cor | Hierarquia por tamanho e peso |
| Numeração 01/02/03 sem sequência real | Numerar só passos de verdade (ex.: "Como funciona") |
| Rótulos microscópicos (< 12px) | Piso `0.75rem` |
| Emoji na interface | SVG inline do projeto (`Icon.astro`) |
| Card dentro de card | Um nível de superfície; divida por espaço ou divisória |
| Elemento decorativo no Tab | Fora da ordem de foco; `aria-hidden` |

## O que parece slop em lista genérica mas é a marca (mantenha)

- Títulos em caixa alta com Archivo Black e `line-height` apertado.
- Kickers/eyebrows curtos em caixa alta acima dos títulos de seção.
- Rotação leve alternada (-8° a 9°) em cards, adesivos e polaroids.
- Sombra dura deslocada sem blur.
- Paleta CMY neon sobre preto e textura de ruído.

Se a tarefa pedir algo fora disso, siga o `DESIGN.md` e pergunte antes de inventar uma direção nova.

## Pergunta final

"Se eu tirar o logo, alguém reconhece que isto é da Jokenpo?" Se a resposta for não, a tela ficou genérica:
volte ao `DESIGN.md` (seção Aesthetic e Signature move) e aplique um elemento da colagem tátil onde fizer sentido.
