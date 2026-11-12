# DESIGN.md - Jokenpo Landing Page

## Context (from discovery)

- Artifact type: Composite marketing landing page, local game-store hub, and weekly event/catalog board
- Positioning: Playful, community-driven, energetic local hub (Arcade 2.0)
- Audience: Card game (TCG) players, boardgame groups, RPG tables, and geek community in Natal/RN | Primary action: Visit the physical store at Shopping New Way Center (Loja 24), check the weekly tournament/boardgame schedule, or join the WhatsApp community
- Adjectives: Tátil (Tactile), Noturno (Nocturnal), Pop-Arcade (Pop-Arcade), Acolhedor (Welcoming)
- Visual word translations:
  - Tátil -> Physical sticker edges, rotated polaroids/cards, hard offset retro shadows (`7px 7px 0` / `8px 8px 0`), zero diffuse blur on cards
  - Noturno -> Deep arcade ink canvas (`#0E0E10`) with high-contrast CMY neon-pop accents and film grain overlay
  - Pop-Arcade -> Heavy uppercase Archivo Black display headlines (`line-height: 0.91`), high-chroma yellow/cyan/pink blocks, tilted badges
  - Acolhedor -> Direct Brazilian Portuguese second-person voice ("vem jogar", "cola na Jokenpo"), clear pass pricing, beginner-friendly FAQ and step-by-step guidance
- Aesthetic essence (3 words): Arcade, Tátil, Comunitário
- Single-minded proposition: O ponto de encontro da comunidade geek de Natal para jogar cartas e tabuleiro sem frescura.
- Archetype: Jester + Everyman (fun, spontaneity, belonging, community table)
- References:
  - Admire: Official Jokenpo Arcade 2.0 brand system (`docs/style-guide.md`) with physical TCG card backs, die stickers, and asymmetric polaroid/note callouts; classic independent game-cafe menu boards
  - Avoid: Generic SaaS AI templates (indigo/violet gradients, uniform 3-card feature grids with icon tiles, blurry glassmorphism cards, microscopic `<12px` labels, non-interactive elements in tab order)
- Mode: Dark (`color-scheme: dark`, intentional nocturnal arcade palette) | Density: Balanced (airy hero and editorial sections, structured dense catalog and pricing board)
- Constraints: Astro 6 static prerendering (`export const prerender = true`), self-hosted Fontsource fonts (`Archivo Black` + `Poppins`), WCAG 2.2 AA accessibility, strict fidelity to `src/data/site.json` and `docs/style-guide.md`

## Aesthetic

- Direction: Bespoke Brand System — **Arcade 2.0** (Nocturnal Pop & Tactile Tabletop)
- Defining trait: High-contrast CMY accent blocks (`--yellow`, `--cyan`, `--pink`) set against deep `--ink` (`#0E0E10`) with hard-edge offset shadows (`box-shadow: 7px 7px 0`) and alternating subtle rotations (`-8deg` to `9deg`) that evoke physical cards, stickers, and tabletop pieces on a game mat.
- Signature move: **Colagem Tátil de Mesa (Tactile Tabletop Collage)** — layered physical artifacts (rotated TCG card backs, 20-sided die, "BORA JOGAR?" die-cut sticker, tilted polaroid quote note, and ticket-style pricing/schedule boards) with crisp solid borders and zero-blur offset shadows.

## Typography

- Display: `Archivo Black` | source: Fontsource (`@fontsource/archivo-black`) | license: OFL
- Body: `Poppins` | source: Fontsource (`@fontsource/poppins`, weights 400, 600, 700) | license: OFL
- Mono: Not used (`font-variant-numeric: tabular-nums` applied on Poppins/Archivo Black for prices, counts, and schedules)
- Scale: Fluid `clamp()` scale anchored on `1rem` (16px) body copy
  | Step | Size | Line-height | Tracking | Use |
  |---|---|---|---|---|
  | Hero Display (`h1`) | `clamp(3.125rem, 0.75rem + 8.5vw, 8.25rem)` | `0.91` | `-0.03em` | Hero main title |
  | Section Display (`h2`) | `clamp(2.15rem, 0.5rem + 6.5vw, 4.875rem)` | `0.92` | `-0.03em` | Section titles |
  | Sub-display (`h3` / Catalog) | `clamp(1.5rem, 1.1rem + 1.5vw, 2.25rem)` | `0.98` | `-0.025em` | Pass titles, sub-sections |
  | Card Heading | `clamp(1.25rem, 1.05rem + 0.6vw, 1.5625rem)` | `1.08` | `-0.02em` | Step, Agenda, Extra, FAQ titles |
  | Body Lead | `clamp(1rem, 0.95rem + 0.25vw, 1.125rem)` | `1.65` | `0` | Hero lead, section intros |
  | Body / UI | `0.9375rem` – `1rem` (15px–16px) | `1.6` | `0` | Descriptions, FAQ answers, кнопки |
  | Meta / Eyebrow | `0.75rem` – `0.8125rem` (12px–13px) | `1.4` | `0.14em`–`0.2em` | Kickers, badges, tags (hard floor: `0.75rem`) |
- Weights: Display 400 (inherently black); Body 400, 600, 700 | Measure: `60ch–72ch` | Tracking notes: Optical tightening (`-0.02em` to `-0.03em`) on uppercase display headings instead of fixed `-3px` so glyphs never collide on narrow viewports.

## Color

- Strategy: Triadic arcade primaries (Yellow, Cyan, Pink) over a near-black nocturnal canvas (`--ink`). Rejects the AI-default indigo/violet gradient ocean in favor of physical print/arcade CMY ink.
- Distribution: 60% neutral (`--ink`, `--ink-2`, `--white`, `--mist`) / 30% brand primary (`--yellow`, `--pink` section & card fills) / 10% sharp accents (`--cyan` kickers, badges, interactive highlights)
- Palette (role -> OKLCH | hex):
  - `--ink` (bg): `oklch(0.16 0.006 285)` | `#0e0e10`
  - `--ink-2` (surface): `oklch(0.23 0.011 285)` | `#1c1c21`
  - `--ink-3` (border): `oklch(0.35 0.015 285)` | `#3a3a42`
  - `--white` (fg): `oklch(1 0 0)` | `#ffffff`
  - `--mist` (muted): `oklch(0.85 0.01 295)` | `#cfcdd4`
  - `--yellow` (accent primary): `oklch(0.88 0.18 95)` | `#ffd400`
  - `--cyan` (accent secondary): `oklch(0.79 0.15 220)` | `#00c8ff`
  - `--pink` (accent tertiary): `oklch(0.66 0.24 350)` | `#ff3ea5`
  - `--purple` (alt dark surface): `oklch(0.28 0.11 285)` | `#2a1e5c`
  - `--surface-warm` (light card surface): `oklch(0.98 0.02 85)` | `#fff7e6`
  - `--ink-on-color` (muted text on yellow/cyan/pink): `oklch(0.22 0.02 285)` | `#18181c`
  - Semantic states:
    - `--success`: `oklch(0.72 0.17 150)` | `#22c55e`
    - `--warning`: `oklch(0.88 0.18 95)` | `#ffd400`
    - `--error`: `oklch(0.65 0.22 25)` | `#ef4444`

## Spacing, radius, shadow

- Spacing base: `4px` (`0.25rem`), scale: `4, 8, 12, 16, 20, 24, 32, 42, 64, 96, 128px`
- Radius:
  - `--radius-card`: `20px` (standard cards, game items, FAQ items)
  - `--radius-feature`: `26px` (hero cards, map frame, main pricing board)
  - `--radius-pill`: `999px` (buttons, filter chips, tags)
- Shadow approach: **Defined Edge & Hard Offset Shadow** (never diffuse blur + hairline border on cards). Interactive and featured surfaces use solid `2px–3px` borders paired with crisp offset shadows (`7px 7px 0 var(--ink)` or `7px 7px 0 var(--ink-3)`).

## Layout and composition

- Grid: 12-column conceptual container (`max-width: 1176px`), asymmetric 2-column hero and editorial splits, bento-style pricing board (featured Afternoon Pass + duo all-day passes + full-width hourly bar), and asymmetric 3-column boards with alternating card tilts and ticket perforations.
- Spacing rhythm: Tight within component groups (`6px–12px` between kicker, heading, and meta); generous between sections (`clamp(4.5rem, 8vw, 7.5rem)` vertical padding).
- Signature layout move: **Asymmetric Tabletop Stage & Ticket Boards** — Hero collage with rotated TCG cards + die + sticker on desktop, hidden completely (`display: none` on `.hero-stage` and `.about-note`) on mobile (`<= 800px`) to keep the vertical flow compact without empty dead space or excessive scrolling; Pricing and Agenda cards styled like physical arcade/tabletop passes with tabular numerals and subtle alternating tilts on interaction.
- Density: Balanced | Scanning: Z-pattern in Hero, F-pattern in Pricing/Agenda/FAQ.
- Responsive: Fluid `clamp()` typography and spacing with primary layout restack at `800px` and catalog grid step at `960px`. Verified down to `320px` width and `200%` zoom.

## Components and states

- Button hierarchy:
  - Primary (`.button-yellow`, `.button-pink`): solid brand fill, `--ink` text, `2px solid var(--ink)` border, hard offset shadow on hover (`translate(-2px, -2px)` + `7px 7px 0`), physical press (`scale(0.97)`).
  - Community CTA (`.button-community`): high-contrast dark green fill with crisp `--white` text and border so it stands out on `--ink` canvas.
  - Secondary / Filter chips (`.filter-btn`): `--ink-2` surface with `2px solid var(--ink-3)`, hover border highlight, active state filled with category color (`--white`, `--cyan`, `--yellow`, `--pink`) + hard offset shadow, `min-block-size: 44px`.
- Navigation (`.site-header`): Single `<nav>` landmark; inline links on desktop with `scroll-target-group: auto` and `.target-current` / `[aria-current='true']` underline indicator; anchored dropdown menu on mobile (`<= 800px`) scaling from `transform-origin: top right`.
- Catalog cards (`.game-card`): Non-interactive `<article>` showcase cards (no stray `tabindex="0"` trap), white box-art stage with subtle inner frame, category pill badge, publisher kicker, and tabular player count.
- Accordions (`.faq-item`): Native `<details>`/`<summary>` with `::details-content` intrinsic size transition (`interpolate-size: allow-keywords`), numbered badge, and rotating `+` indicator.
- Focus ring: `box-shadow: 0 0 0 2px var(--ink), 0 0 0 5px var(--yellow)` (follows `border-radius` cleanly on every control) with `outline: 2px solid transparent` fallback for `forced-colors: active`.

## Motion

- Duration scale:
  - `--duration-instant`: `100ms` (button press)
  - `--duration-fast`: `160ms` (color/border/focus transitions, menu open)
  - `--duration-normal`: `240ms` (card hover lift, accordion disclosure)
  - `--duration-slow`: `320ms` (catalog filter reveal)
- Easing:
  - `--ease-out`: `cubic-bezier(0.22, 1, 0.36, 1)`
  - `--ease-in-out`: `cubic-bezier(0.65, 0, 0.35, 1)`
- What animates: `transform`, `opacity`, and progressive-enhancement `block-size` on `::details-content`. Hover transforms gated behind `@media (hover: hover)` and `@media (prefers-reduced-motion: no-preference)`.
- Marquee accessibility: Includes a keyboard-accessible pause/play toggle button in the corner of the category strip and pauses automatically on `:hover` / `:focus-within`.

## Iconography

- Set: Custom geometric inline SVGs (`ArrowIcon`, 20-sided die, 4-point arcade sparkles, WhatsApp glyph) | stroke: `2.5px–3.5px` | caps/joins: `round` | No emojis anywhere in UI or copy.

## Imagery and illustration

- Mode: Real boardgame box covers (`astro:assets` `<Image />` with explicit `width`/`height`) paired with official Jokenpo vector assets (`coelho-creme.svg`, `brilho-rosa.svg`, `faixa-categorias.svg`) and CSS/SVG tabletop artifacts.
- Texture: Fixed SVG `feTurbulence` noise overlay (`opacity: 0.16`, `mix-blend-mode: overlay`) across `.site-shell` + radial dot-matrix pattern in the Hero.

## Dark mode

- Intentional single dark palette (`color-scheme: dark`). Near-black `--ink` (`#0E0E10`) canvas, elevated `--ink-2` (`#1C1C21`) card surfaces, `--ink-3` (`#3A3A42`) structural borders, and high-luminance CMY accents.

## Accessibility

- Contrast: WCAG 2.2 AA verified across all dark and colored surfaces (`--ink` on `--yellow`/`--cyan`/`--pink` exceeds 7:1; `--white` and `--mist` on `--ink`/`--ink-2` exceed 11:1).
- Focus: Managed `:focus-visible` ring following border-radius via `box-shadow`, never obscured by sticky header (`scroll-padding-top: 96px`).
- Keyboard: Only genuinely interactive controls (`<a>`, `<button>`, `<summary>`) are in the tab order. Mobile menu supports `Escape` and outside-pointer dismissal.
- Targets: All interactive buttons, filter pills, and links meet `>= 44px` hit target height (`>= 24px` minimum for inline text links with generous line spacing).
- Color independence: Active nav links use underline; game categories pair color with explicit text labels (`Leves`, `Médios`, `Grandes`).

## Tokens (source of truth)

```css
:root {
	color-scheme: dark;
	--font-display: 'Archivo Black', sans-serif;
	--font-body: 'Poppins', sans-serif;

	/* Colors (OKLCH with Hex fallback) */
	--ink: #0e0e10;
	--ink: oklch(0.16 0.006 285);
	--ink-2: #1c1c21;
	--ink-2: oklch(0.23 0.011 285);
	--ink-3: #3a3a42;
	--ink-3: oklch(0.35 0.015 285);
	--mist: #cfcdd4;
	--mist: oklch(0.85 0.01 295);
	--white: #ffffff;
	--white: oklch(1 0 0);
	--yellow: #ffd400;
	--yellow: oklch(0.88 0.18 95);
	--cyan: #00c8ff;
	--cyan: oklch(0.79 0.15 220);
	--pink: #ff3ea5;
	--pink: oklch(0.66 0.24 350);
	--purple: #2a1e5c;
	--purple: oklch(0.28 0.11 285);
	--surface-warm: #fff7e6;
	--surface-warm: oklch(0.98 0.02 85);

	/* Radius & Shadows */
	--radius-card: 20px;
	--radius-feature: 26px;
	--radius-pill: 999px;
	--shadow-hard: 7px 7px 0 var(--ink);
	--shadow-hard-surface: 7px 7px 0 var(--ink-3);

	/* Motion */
	--duration-instant: 100ms;
	--duration-fast: 160ms;
	--duration-normal: 240ms;
	--duration-slow: 320ms;
	--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
	--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

- Adapter: Plain CSS custom properties in `src/styles/global.css` + Astro scoped `<style>` blocks.

## Cards and surfaces

- Cards/surfaces: Solid `2px` border + hard offset shadow (`7px 7px 0`), `20px–26px` radius, `24px–32px` padding. Never stack diffuse blur shadows on bordered cards; never nest cards inside cards.

## Slop audit

- Date: 2026-11-12 | Result: Fixed 11 tells across typography, layout, motion, components, and accessibility
- Notes:
  1. Replaced sub-floor `9px–11px` pixel font sizes with accessible `rem`/`clamp()` tokens (`>= 0.75rem` floor for metadata, `>= 0.875rem` for controls, `1rem` body).
  2. Replaced destructive fixed `-3px` display letter-spacing with optical relative tracking (`-0.03em` / `-0.02em`).
  3. Removed `tabindex="0"` from non-interactive `.game-card` articles and redundant `role="region"` from `.faq-list`.
  4. Added a visible pause/play control and hover/focus pause to `Marquee.astro` so persistent motion complies with UI/UX guidelines and WCAG 2.2.2.
  5. Collapsed the entire `.hero-stage` and decorative `.about-note` on mobile (`<= 800px`) with `display: none` so neither decorative cards nor an empty 350px container add unnecessary vertical scroll.
  6. Broke the repetitive 3-equal-card template across `HowItWorksSection`, `AgendaSection`, and `ExtrasSection` with tactile ticket cutouts, step connectors, and alternating sticker rotations.
  7. Unified hard-offset shadows (`--ink-3` on dark canvas so shadows are actually visible, `--ink` on colored surfaces) and eliminated diffuse blur shadows on bordered cards.
  8. Upgraded focus rings to `box-shadow` so they follow `border-radius` cleanly, and fixed `Header.astro` `.target-current` / `[aria-current='true']` selector for cross-browser scrollspy support.
  9. Applied `font-variant-numeric: tabular-nums` to all pricing, schedule times, and badge counts.
  10. Added smooth intrinsic-size disclosure animation (`::details-content` + `interpolate-size: allow-keywords`) to `FaqSection.astro`.
  11. Upgraded all interactive buttons, filter pills, and card CTAs to comfortable `>= 44px` touch targets and gated hover transforms behind `@media (hover: hover)`.

## Changelog

- 2026-11-12: Initial `DESIGN.md` created and full landing page deslop & UI/UX overhaul applied across `global.css` and all Astro components.
