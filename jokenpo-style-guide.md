# Jokenpô — Style Guide de Marca (Arcade 2.0)

Guia para um agente de IA reproduzir as peças da marca em outros projetos.
Todas as peças são construídas em **HTML + CSS absoluto** (um `<div>` raiz com
`position: relative; overflow: hidden` e filhos em `position: absolute`).

---

## 1. Identidade

**Jokenpô** — loja de card games e boardgames (MEI), Shopping New Way Center,
Zona Norte, Natal/RN. Instagram: `@jokenpoficial`.

**Personalidade visual:** arcade noturno, pop, energético, lúdico. Cores
saturadas sobre preto, tipografia pesada em caixa alta, elementos "colados"
(stickers, cartas, polaroides) com leve rotação e sombra forte.

**O que evitar:** layouts "quadradões blocados" (blocos retangulares empilhados
sem hierarquia), degradês pastéis, minimalismo frio sem cor, serifadas,
mais de um bloco de texto corrido por peça.

---

## 2. Cores

### Base

| Token | Hex | Uso |
|---|---|---|
| `ink` | `#0E0E10` | Preto da marca. Fundo padrão, texto sobre cores claras, contornos de sticker |
| `ink-2` | `#1C1C21` | Preto elevado — cards sobre fundo preto |
| `ink-3` | `#3A3A42` | Divisórias, linhas tracejadas, texto terciário sobre preto |
| `mist` | `#CFCDD4` | Texto secundário sobre fundo escuro |
| `white` | `#FFFFFF` | Texto principal sobre escuro, fundo de carta/polaroide |

### Acento (as três cores do arcade)

| Token | Hex | Uso |
|---|---|---|
| `yellow` | `#FFD400` | Cor primária. Destaques, números, CTA, pílulas |
| `cyan` | `#00C8FF` | Secundária. Kickers, links, segunda linha de título |
| `pink` | `#FF3EA5` | Terciária. Ênfase, badges, a palavra-chave do título |
| `purple` | `#2A1E5C` | Fundo escuro alternativo (único roxo permitido como base) |

### Variantes de apoio

| Hex | Uso |
|---|---|
| `#E5BE00` / `#00A6D6` / `#D92A89` | Versões escurecidas do amarelo/ciano/rosa, para formas de fundo *sobre* a própria cor |
| `#5FE0FF` / `#FF7CC2` / `#FFE760` / `#4A3A99` | Versões claras, só para o centro de degradê radial |
| `#FFF7E6` / `#FFD6EB` / `#E4DEFF` | Cards claros sobre fundo colorido (estilo notificação) |

### Regras de cor

- Nunca mais de **três cores de acento** na mesma peça.
- Um título tricolor usa no máximo: branco + 1 acento.
- Texto preto sobre amarelo/ciano/rosa; texto branco sobre preto/roxo.
- Fundo roxo (`#2A1E5C`) troca o preto por branco em todos os textos e contornos.

### Código de categoria (boardgames)

| Categoria | Cor |
|---|---|
| Leves | `cyan` `#00C8FF` |
| Médios | `yellow` `#FFD400` |
| Grandes | `pink` `#FF3EA5` |

---

## 3. Tipografia

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Poppins:ital,wght@0,400;0,600;0,700;1,600;1,700&display=swap">
```

| Papel | Fonte | Regras |
|---|---|---|
| **Display / títulos** | `'Archivo Black', sans-serif` | Sempre CAIXA ALTA. `line-height` 0.86–1.04. `letter-spacing: -2px` em tamanhos ≥120px |
| **Texto / UI** | `'Poppins', sans-serif` | Pesos 400, 600, 700. Itálico 600/700 só para subtítulos de jogo ("*Magic: The Gathering*") |

`font-family` padrão do container raiz: Poppins. Archivo Black é aplicado
inline por elemento.

### Escala (peça 1080px de largura)

| Nível | px | Fonte |
|---|---|---|
| Hero gigante (uma palavra) | 196–290 | Archivo Black |
| Título principal | 58–128 | Archivo Black |
| Subtítulo / preço | 34–66 | Archivo Black |
| Rótulo de destaque | 26–32 | Archivo Black |
| Corpo | 20–28 | Poppins 600/700 |
| Kicker / legenda | 14–22 | Poppins 700, `letter-spacing: 3–6px`, CAIXA ALTA |
| Rodapé / `@handle` | 18–26 | Poppins 700 |

### Hierarquia de título (padrão da marca)

Três linhas, a última na cor de acento:

```html
<div style="font-family:'Archivo Black',sans-serif; font-size:58px; line-height:1.04; color:#0E0E10">
  HOJE TEM<br>SEMANAL<br><span style="color:#FF3EA5">POKÉMON!</span>
</div>
```

---

## 4. Formatos

| Formato | px | Uso |
|---|---|---|
| Story | 1080 × 1920 | Stories, capas de destaque |
| Feed | 1080 × 1350 | Posts (4:5) |
| Quadrado | 1080 × 1080 | Quando pedido |

**Zona segura do story:** conteúdo entre `y 250` e `y 1670`. Nada essencial
fora disso.

**Margem lateral padrão:** 90–112px.

**Conversão story → feed:** envolver o conteúdo em
`transform: translateY(-187.5px) scale(0.91); transform-origin: 50% 0`
e manter faixas/âncoras de topo e rodapé fora do wrapper.

---

## 5. Esqueleto de uma peça

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Nome da peça</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Poppins:ital,wght@0,400;0,600;0,700;1,600;1,700&display=swap">
<style>body{margin:0}</style>
</head>
<body>
<div style="width:1080px; height:1920px; box-sizing:border-box; background:#0E0E10;
            font-family:'Poppins',sans-serif; position:relative; overflow:hidden">
  <!-- camadas, de baixo para cima -->
</div>
</body>
</html>
```

### Ordem das camadas

1. Fundo (cor sólida ou degradê radial)
2. Formas geométricas de fundo (círculos, anéis, grade de pontos, ondas)
3. Tipografia gigante de contorno (opcional, opacidade baixa)
4. Grão (ruído)
5. Cards / conteúdo
6. Objetos colados (cartas, coelho, stickers)
7. Logo e rodapé

---

## 6. Texturas e efeitos

### Grão (sempre presente)

```html
<svg style="position:absolute; inset:0; mix-blend-mode:multiply; opacity:0.32; pointer-events:none"
     width="1080" height="1920" aria-hidden="true">
  <filter id="g1">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="1" stitchTiles="stitch"></feTurbulence>
    <feColorMatrix type="saturate" values="0"></feColorMatrix>
  </filter>
  <rect width="100%" height="100%" filter="url(#g1)"></rect>
</svg>
```

Opacidade 0.18–0.32 (`multiply` sobre claro, `overlay` sobre escuro).
Trocar o `seed` e o `id` em cada peça.

### Fundo em degradê radial

```css
background: radial-gradient(120% 80% at 50% 45%, #FFE760 0%, #FFD400 62%);
```

### Grade de pontos

```css
background-image: radial-gradient(#0E0E1033 4px, transparent 4.5px);
background-size: 26px 26px;
```

### Listras diagonais (verso de carta)

```css
background: repeating-linear-gradient(135deg, #FF3EA533 0 14px, transparent 14px 34px);
```

### Tipografia gigante de contorno (fundo)

```html
<div style="font-family:'Archivo Black',sans-serif; font-size:290px; line-height:0.86;
            color:transparent; -webkit-text-stroke:3px #0E0E10; opacity:0.13;
            white-space:nowrap; text-align:center">HOJE!</div>
```

Repetir 6–8 vezes numa coluna flex, com o container estourando a largura
(`left:-200px; right:-200px`).

### Brilho de 4 pontas (sparkle)

```html
<svg width="84" height="84" viewBox="0 0 100 100" aria-hidden="true">
  <path d="M50 0 C54 36 64 46 100 50 C64 54 54 64 50 100 C46 64 36 54 0 50 C36 46 46 36 50 0Z" fill="#FFFFFF"></path>
</svg>
```

Usar 2–3 por peça, tamanhos diferentes (30/44/84px), opacidade 0.4–1.

---

## 7. Componentes

### Card de conteúdo (claro sobre fundo colorido)

```css
background: #FFF7E6;      /* tom claro da cor do fundo */
border-radius: 29px;
box-shadow: 0 26px 40px rgba(0,0,0,.30);
padding: 44px 40px;
```

### Sticker / objeto colado

Contorno preto sólido feito por `drop-shadow`, não por `border`:

```css
filter: drop-shadow(4px 0 0 #0E0E10) drop-shadow(-4px 0 0 #0E0E10)
        drop-shadow(0 4px 0 #0E0E10) drop-shadow(0 -4px 0 #0E0E10)
        drop-shadow(0 22px 28px rgba(0,0,0,.28));
```

### Carta de TCG (verso)

```css
width: 300px; height: 430px;
transform: rotate(5deg);
border-radius: 22px;
background: #FFFFFF;        /* a borda branca da carta */
padding: 13px;
box-shadow: 30px 40px 50px rgba(0,0,0,.28), 8px 10px 16px rgba(0,0,0,.18);
```

Miolo: fundo `#0E0E10`, listras diagonais na cor de acento, logo circular
centralizado, "JOKENPO" em Archivo Black no rodapé.

### Pílula

```css
padding: 12px 30px;
border-radius: 40px;
background: #FFD400;                 /* ou border: 3px solid currentColor */
font-family: 'Poppins'; font-size: 24px; font-weight: 700;
letter-spacing: 4px; text-transform: uppercase;
```

### Polaroide (foto)

```css
background: #FFFFFF;
padding: 14px;
transform: rotate(8deg);
box-shadow: 0 18px 0 #0E0E10;        /* sombra dura, offset puro */
```

### Sombra dura (retrô)

```css
box-shadow: 8px 8px 0 #0E0E10;
```

### Faixa de destaque

Retângulo cheio na cor de acento, texto preto, `border-radius: 24px`,
kicker + uma linha de informação. Nunca mais de uma por peça.

---

## 8. Raios e rotações

**Raios de borda:** `29px` (card padrão), `24px` (faixa), `22px` (carta),
`16px` / `18px` / `21px` (elementos menores), `40px`+ (pílula), `50%` (círculo).

**Rotações:** sempre leves e alternadas — `-8°`, `-6°`, `-3°`, `-2°`,
`4°`, `5°`, `8°`, `10°`. Nunca dois objetos vizinhos no mesmo ângulo.

---

## 9. Logo e assinatura

- Duas versões: **amarela** (sobre preto/roxo) e **preta** (sobre amarelo/ciano/rosa).
- Largura típica: 200–250px no story.
- Posições: canto superior esquerdo (`left:70–90px; top:52–64px`) ou centralizado no rodapé (`top ~1560px`).
- Mascote: **coelho** (o "Jô"), em branco com contorno preto de sticker. Usar
  como objeto colado no canto inferior, nunca sobrepondo texto.
- Assinatura de rodapé: `@jokenpoficial · Shopping New Way Center` —
  Poppins 700, 24–26px.

---

## 10. Voz e conteúdo

- Português brasileiro, informal e direto, segunda pessoa ("vem jogar",
  "bora jogar?", "cola lá").
- Títulos curtos, 2–3 linhas, sem ponto final (exclamação é permitida).
- **Sem emojis** nas peças e na bio.
- Preços sempre em `R$ 00` com espaço.
- Horários no formato `18h30`, dias abreviados `SEG · TER · QUA · SEX`.
- Chamada de ação no rodapé ou em pílula, nunca no meio do texto.
- Em posts de resultado de torneio: **não mostrar valores de crédito ganhos**.

---

## 11. Checklist antes de entregar

1. Renderizar a peça inteira e olhar — não conferir só o elemento alterado.
2. Nada sobrepondo texto; nada fora da zona segura.
3. Título cabe em até 3 linhas sem quebra feia.
4. Máximo três cores de acento.
5. Grão presente.
6. Logo e `@jokenpoficial` presentes.
7. Ao criar uma variação nova, **manter as versões anteriores** — nunca
   substituir a peça antiga.
